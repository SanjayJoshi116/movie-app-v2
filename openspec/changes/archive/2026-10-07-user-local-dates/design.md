## Context

See proposal.md for the problem. The code facts below shape the approach (checked 2026-10-07):

- **Server clock:** `settings.TIME_ZONE = "UTC"`, `USE_TZ = True`. Every stored time is an aware UTC instant, so the stored data isn't wrong. Only the step that turns an instant into a day is.
- **Where instants become days:**
  - `stats_views.py:57` (month key), `:110-111` (heatmap cutoff and `.date()`), `:168` (recent items' `strftime("%Y-%m-%d")`)
  - `notifications_views.py:30-32` (`today`, `last_seen_date`)
  - `CalendarPage.tsx:75,126,136-137` (`toISOString().slice(0,10)`)
  - `WatchedPage.tsx:243` → `formatDateDMY`, which takes the date part of the ISO string, i.e. the UTC date
- **How `WatchedEntry.watched_at` gets set:**
  - On normal create, the server sets it (read-only in `WatchedEntrySerializer`, default `timezone.now`), in `watched_views.py:23`.
  - `bulk_watched` takes a supplied `watchedAt` through `timestamp_or_now()`.
- **CORS:** in development the frontend (`:3000`) calls Django (`:8000`) cross-origin, and in production nginx serves them same-origin. `CORS_ALLOW_HEADERS` isn't set, so django-cors-headers only allows its default header list. A new custom header would fail the browser's preflight in development and LAN setups.
- **API clients:** `userApi.ts` has the authenticated axios instance with its request interceptor. `publicApi` is for login, register and reset, and doesn't need a time zone. The token refresh is a bare `axios.post` that doesn't need one either.
- **`tzdata`:** it's pinned in `constraints.txt` but only installed on Windows. Linux images may lack a system zoneinfo database.

## Goals / Non-Goals

**Goals:**
- A past watch always lands on the day it was logged, in the time zone it was logged in, on every device.
- "Today" follows the current device.
- No account setting, no UI to configure, and no breaking API change.

**Non-Goals:**
- Recovering time zones for existing entries. There's no source for them, so they stay blank.
- Ratings and watchlist timestamps. Nothing groups them by day.
- Date-only import values (e.g. `2024-03-01` with no time). DRF rejects them today, and this change doesn't alter that.
- Background jobs that need a user's date. None exist. If a daily digest is added later, it will need a per-account time zone. That's a separate decision.

## Decisions

### D1. The device's time zone travels as an `X-Timezone` request header
- **Sending it:** `userApi`'s request interceptor adds `X-Timezone: Intl.DateTimeFormat().resolvedOptions().timeZone` (an IANA name). This covers every authenticated call, bulk imports included.
- **Reading it:** server-side, a single helper `request_tz(request) -> ZoneInfo` in `backend/userdata/timezones.py` reads `HTTP_X_TIMEZONE` and returns `ZoneInfo(name)`. Any of these returns UTC instead of raising: a missing value, a name longer than 64 characters, or an unknown name (`ZoneInfoNotFoundError`, `ValueError`). That keeps the project's "bad input never 500s" rule without rejecting requests from older clients. A companion `request_tz_name(request) -> str` returns the validated name, or `""` when the header is missing or invalid, for storing.
- **CORS:** `settings.py` sets `CORS_ALLOW_HEADERS = (*default_headers, "x-timezone")`, so the cross-origin development setup passes preflight.

*Alternatives:*
- **Per-account time zone on `Profile`:** rejected. It goes stale when a user travels or uses devices in different zones, and it needs a migration plus a UI.
- **A `?tz=` query parameter:** rejected. It's noisier, has to be added at every call site, and ends up in logs and caches.
- **Bucketing everything client-side (raw timestamps):** rejected. Notifications' unread state is server logic, and Stats would need a client-side rewrite.

### D2. `WatchedEntry.watched_tz` stores the time zone at log time
- **Field:** `CharField(max_length=64, blank=True, default="")`, plus a migration. Existing rows become `""`.
- **Create:** `watched_list` POST saves `watched_tz=request_tz_name(request)`.
- **Bulk import:** `bulk_watched` takes an optional per-row `watchedTz`, validated with the same rules. An invalid value is stored as `""`; it isn't rejected, because one bad cell shouldn't fail a 500-row import. It is not filled in from the header: a CSV row's original time zone is unknown, and blank is the honest value.
- **Read field:** the serializer exposes `watchedTz` (read-only on normal entries).

### D3. One rule for "the day of a watch"
`entry_day(entry, request) = watched_at.astimezone(entry_tz).date()`, where `entry_tz` is:
- `ZoneInfo(watched_tz)` if the entry has a valid one,
- otherwise `request_tz(request)`.

Implemented once, in `timezones.py`. Stats uses it for:
- the month key (`.year` / `.month` from the localized datetime)
- the heatmap day
- recent items' `watchedAt` date

Stats sorting stays by instant.

### D4. One rule for "today"
`local_today(request) = timezone.now().astimezone(request_tz(request)).date()`.
- **Heatmap window:** the cutoff is computed from `local_today` minus 364 days, and compared against each entry's `entry_day`. It no longer compares a UTC instant cutoff.
- **Notifications:** `today = local_today(request)`, and `last_seen_date = checkpoint.last_seen_at` converted to `request_tz`. The unread rule stays `release_date > last_seen_date`. A release dated today was already visible at the moment of the last check, so it was seen. The bug was only whose "today" that was.
- **Calendar:** all frontend. A small `localISODate(d: Date)` (`yyyy-mm-dd` from `getFullYear/getMonth/getDate`) in `formatDate.ts` replaces the four `toISOString().slice(0,10)` uses. The iCal `DTEND` all-day value uses the same helper.

### D5. Watched page: the date in its logged time zone, labeled when it differs
- **Formatting:** `formatDateInTz(iso, tz)` in `formatDate.ts` uses `Intl.DateTimeFormat("en-US", { timeZone: tz, year, month, day })` parts to build `dd-mm-yyyy`, keeping the `formatDateDMY` format convention. When `tz` is blank, it uses the device time zone.
- **Label:** shown only when the logged zone's UTC offset at that instant differs from the device zone's offset at that same instant. Comparing offsets rather than names treats aliases like `Asia/Calcutta` and `Asia/Kolkata`, or two zones that share an offset, as the same.
- **Label text:** `Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })`. The fixed locale keeps it deterministic per the date convention. It renders, for example, `EDT` or `GMT+5:30`. The user's example label "IST" only appears under the `en-IN` locale; the `en-US` short name for India is `GMT+5:30`. So the label shown is `07-10-2026 · GMT+5:30`. That's acceptable and unambiguous.
- **Sorting:** the Watched page sort stays by the ISO instant.

### D6. Backups and CSV carry `watched_tz` (additive)
- **Export:** `backup.ts` watched rows and `WatchedPage`'s CSV export add a `watched_tz` column after `watched_at`.
- **Import:** `csvParse.ts` reads it when present, as optional, the same way as `runtime_minutes`/`platform`, and `bulkImport` sends it as `watchedTz`.
- **Older files:** a file without the column imports as before, with a blank time zone. This follows the "backup format changes stay additive" convention.

### D7. `tzdata` is a direct dependency
- Add `tzdata` to `backend/requirements.txt`, pinned to the version already in `constraints.txt`.
- Update the `constraints.txt` comment that says it's Windows-only.
- `test_dependency_versions.py` is about Django only, so it's unaffected.

## Risks / Trade-offs

- **[Legacy entries near midnight still look off by a day on some devices]** → Unavoidable, since the original time zone is unknown. New entries are correct, and the Watched page shows no label for blank entries, because they're shown in the device time zone by definition.
- **[A device with a wrong system time zone logs wrong days]** → That matches what the user's own clock shows them, which is the intended behavior.
- **[Two devices disagree on "today" for notifications]** → By design: "today" is per device. The unread checkpoint is a single instant, so marking seen on one device clears the badge everywhere. Only the boundary day can differ.
- **[A forged or garbage header]** → It falls back to UTC. It only affects the sender's own view and their own entries' time zone label.
- **[A forgotten CORS header breaks development silently]** → A test asserts `x-timezone` is in `CORS_ALLOW_HEADERS`, and the live check runs cross-origin under `npm run dev`.

## Migration Plan

1. Deploy the backend with the migration. It's additive: a blank default and no data rewrite.
2. Deploy the frontend. Old cached frontends without the header keep today's UTC behavior.
3. Rollback: revert both. The extra column is harmless if left in place, or it can be reversed with a migration.
