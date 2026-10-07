## Why

Every "which day was it?" question in the app is answered in UTC, not in the user's own time zone. For anyone outside UTC, things land on the wrong day near midnight:
- **Watched history and Stats:** a movie watched at 01:00 in India is filed under the previous day. That affects the Watched page date, the Stats heatmap, the monthly chart and the "recently watched" list.
- **Calendar:** "today" and the 60-day release window start from the UTC date.
- **Notifications:** "today" and the "last seen" day come from the server's clock. Whether a release counts as new depends on where the server runs, not on the user.

A user can also use several devices in different time zones. So the answer can't be a single per-account setting. This is backlog item #5. Its open design question is settled:
- **"Today"** follows the device the user is on right now.
- **A past watch** stays on the day it was logged, in the time zone it was logged in, whichever device views it later.

## What Changes

### The device tells the server its time zone
- Every authenticated API request carries the device's IANA time zone name, e.g. `Asia/Kolkata`, taken from the browser's `Intl` settings.
- The server validates the name. A missing or unknown value falls back to UTC; it never causes an error.
- No account setting and no UI are needed.

### Each watch is logged with its time zone
- `WatchedEntry` gains `watched_tz`, the time zone the entry was logged in.
- **Marking a title watched:** stores the request's time zone with it.
- **Bulk imports:** an imported row may carry its own time zone; without one, the time zone stays blank.
- **Older entries:** existing rows also keep a blank time zone. They show in the viewing device's time zone, because their original time zone can't be recovered.

### Days are computed in the right time zone
- **Past watches** use their logged time zone, falling back to the device's, then UTC. This covers the Watched page date, the Stats heatmap, the monthly chart and "recently watched".
- **"Today"** uses the device's time zone. This covers the Stats heatmap's one-year window, the notification release window and its unread rule, and the Calendar.

### The Watched page shows the time zone when it differs
- When an entry was logged in a different time zone from the current device, its date is followed by a short time-zone label, e.g. `07-10-2026 · IST`.
- When the two match, nothing extra is shown.

### Backups and CSV export keep the time zone
- Watched exports gain a `watched_tz` column.
- Importing a backup restores the time zone.
- Older backups without the column still import, with a blank time zone.

### Dependency
- `tzdata` becomes a direct backend dependency, so time-zone names resolve on every platform. Today it's only installed on Windows, as a side effect of another package.

## Capabilities

### New Capabilities
- `local-dates`: covers which time zone decides "today" and which decides the day of a past watch; how the device's time zone reaches the server; how it's stored per watched entry; and how it's shown.

### Modified Capabilities
- `data-backup`: watched exports and backups carry the logged time zone and restore it on import, while older backups keep importing.

## Impact

- **Backend:**
  - `models.py`: `WatchedEntry.watched_tz` plus a migration
  - a small helper module that resolves the request's time zone
  - `watched_views.py`: create and bulk create
  - `serializers.py`: `watchedTz` (read on entries, optional on bulk import)
  - `stats_views.py`: monthly, heatmap and recent items
  - `notifications_views.py`
  - `requirements.txt` / `constraints.txt` (`tzdata`)
- **Frontend:**
  - `userApi.ts`: request interceptor that adds `X-Timezone`; it also needs to be on the bulk-import path
  - `formatDate.ts`: date in a given time zone, plus a short label
  - `WatchedPage.tsx`
  - `CalendarPage.tsx`: local dates instead of `toISOString()`
  - `backup.ts`, `csvParse.ts`: additive `watched_tz` column
  - types: `watchedTz` on watched entries
- **API:** additive only. There's a new optional request header and a new read field `watchedTz`. Old clients without the header get UTC, which is today's behavior.
- **No changes** to ratings (`rated_at`) or the watchlist (`added_at`), because nothing groups them by day.
