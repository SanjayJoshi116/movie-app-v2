## 1. Backend: time-zone plumbing

- [x] 1.1 `requirements.txt`: add `tzdata` pinned to the `constraints.txt` version; fix the Windows-only comment in `constraints.txt`
- [x] 1.2 `settings.py`: `CORS_ALLOW_HEADERS = (*default_headers, "x-timezone")` (from `corsheaders.defaults`)
- [x] 1.3 New `backend/userdata/timezones.py`: `request_tz(request)` / `request_tz_name(request)` (header `X-Timezone`, ≤64 chars, `ZoneInfo` validation, UTC / `""` fallback), `valid_tz_name(name)`, `entry_day(entry, request)`, `local_today(request)` (D1, D3, D4)
- [x] 1.4 `WatchedEntry.watched_tz = CharField(max_length=64, blank=True, default="")` + migration (generated with the `django` env interpreter; check its header doesn't say Django 6.0)

## 2. Backend: write and read paths

- [x] 2.1 `watched_views.py` create: save `watched_tz=request_tz_name(request)`
- [x] 2.2 `BulkWatchedEntrySerializer`: optional `watchedTz` (`max_length=64`, blank allowed); `bulk_watched` stores `valid_tz_name(...)` or `""`, never the header
- [x] 2.3 `WatchedEntrySerializer`: read-only `watchedTz`
- [x] 2.4 `stats_views.py`: month key, heatmap day and cutoff, and recent items' date through `entry_day` / `local_today`
- [x] 2.5 `notifications_views.py`: `today = local_today(request)`, `last_seen_date` in `request_tz(request)`
- [x] 2.6 Tests:
  - `timezones.py`: unknown, missing, overlong and valid header; entry with and without a logged zone
  - create stores the zone
  - bulk import with a valid, an invalid and a missing `watchedTz`
  - stats with the Kolkata 01:00 → London scenario, and a legacy-entry scenario
  - notifications with the New York late-evening scenario
  - `x-timezone` present in `CORS_ALLOW_HEADERS`
- [x] 2.7 `G:/Anaconda/envs/django/python.exe -m pytest backend`, `ruff check backend/`, `makemigrations --check --dry-run` (with `DEBUG=True`)

## 3. Frontend

- [x] 3.1 `userApi.ts`: request interceptor adds `X-Timezone` from `Intl.DateTimeFormat().resolvedOptions().timeZone` (guarded with try/catch → header omitted); Jest test that the header is sent
- [x] 3.2 Types: `watchedTz?: string` on `WatchedEntryDTO`/`WatchedEntry`; map it in the watched hook/context
- [x] 3.3 `formatDate.ts`: `localISODate(d)`, `formatDateInTz(iso, tz)`, `tzLabelIfDifferent(iso, tz)` (offset comparison, fixed `en-US` short name, D5); Jest tests (Kolkata vs London, same zone → no label, blank tz → device zone, aliases → no label)
- [x] 3.4 `WatchedPage.tsx`: date via `formatDateInTz` + label when different
- [x] 3.5 `CalendarPage.tsx`: replace the 4 `toISOString().slice(0,10)` uses (`:75,126,136-137`) with `localISODate`
- [x] 3.6 `backup.ts` + WatchedPage CSV export: add `watched_tz` column after `watched_at`; `csvParse.ts` reads it as optional; bulk import sends `watchedTz`; Jest: round trip keeps it, v1/v2 files without it still parse
- [x] 3.7 `npm run typecheck`, `npm run lint`, full Jest

## 4. E2E and live check

- [x] 4.1 Python e2e: Watched page shows `· <label>` for a mocked entry with a different `watchedTz` and nothing for a matching one (use Playwright `timezone_id` on the context); update mocks whose watched entries now carry `watchedTz` only where needed
- [x] 4.2 Run the Python e2e and TS Playwright suites one at a time (TS with `--workers=2`)
- [x] 4.3 Live check under `npm run dev` (cross-origin, so preflight is exercised) with a throwaway `verify_*.py`:
  - a browser context with `timezone_id="Asia/Kolkata"` marks a title watched → API shows `watchedTz: "Asia/Kolkata"`
  - a second context with `timezone_id="Europe/London"` shows the same day on Stats/Watched, with the label
  - no CORS errors in the console
  - delete the script afterwards

## 5. Docs

- [x] 5.1 CLAUDE.md: dates convention: "today" = device time zone via `X-Timezone`; a watch's day = its `watched_tz`, through `timezones.py` helpers only; never `toISOString().slice(0,10)` or `.date()` on a UTC instant for user-facing days
- [x] 5.2 `docs/ARCHITECTURE.md` rationale bullet (header vs profile setting, per-entry time zone, offset-based label); README: Watched/Stats date behavior and the backup `watched_tz` column
- [x] 5.3 `docs/BUG_BACKLOG.md`: row 5 → 📝 `user-local-dates`; fix the stale "📝 proposed as 5 changes" heading on section 7
