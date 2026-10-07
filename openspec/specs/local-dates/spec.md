# local-dates Specification

## Purpose

Makes every date the app shows match the user's own clock: "today" follows the device the user is on, and a past watch stays on the day it was logged, in the time zone it was logged in, on every device that views it.

## Requirements

### Requirement: The device's time zone reaches the server
Every authenticated request from the app SHALL tell the server the device's
time zone (an IANA name such as `Asia/Kolkata`). The server SHALL accept a
missing, malformed or unknown time zone and treat it as UTC. It SHALL NOT
reject the request or fail because of it. The development setup, where the
app and the API are on different origins, SHALL accept the time zone header.

#### Scenario: Unknown time zone
- **WHEN** a request carries the time zone `Mars/Olympus_Mons`
- **THEN** the request succeeds and its dates are computed in UTC

#### Scenario: Older client without a time zone
- **WHEN** a request carries no time zone at all
- **THEN** the request succeeds and its dates are computed in UTC, as before this change

### Requirement: A watch is logged with its time zone
When a user marks a title as watched, the entry SHALL record the time zone of
the device that logged it. A bulk-imported entry SHALL record the time zone
supplied for that row, or no time zone when none is supplied or it is
invalid. Entries that existed before this change SHALL have no time zone.

#### Scenario: Marking watched from India
- **WHEN** a user on a device set to `Asia/Kolkata` marks a movie watched
- **THEN** the entry's logged time zone is `Asia/Kolkata`

#### Scenario: Import row with an invalid time zone
- **WHEN** a bulk watched import includes a row whose time zone is `not-a-zone`
- **THEN** the row is imported with no time zone and the rest of the import is unaffected

### Requirement: The day of a past watch comes from its logged time zone
Every place that shows or groups watches by day or month SHALL compute that
day in the entry's logged time zone, or in the viewing device's time zone when
the entry has none. This covers the Watched page date, the Stats daily
heatmap, the Stats monthly chart and the Stats recently-watched list. The same
entry SHALL fall on the same day on every device.

#### Scenario: Watched just after midnight in India, viewed from London
- **WHEN** a user logs a watch at 01:00 on 7 October in `Asia/Kolkata` (19:30 UTC on 6 October) and later opens Stats on a device set to `Europe/London`
- **THEN** the heatmap and the recently-watched list show the watch on 7 October

#### Scenario: Legacy entry without a time zone
- **WHEN** an entry with no logged time zone, watched at 23:30 UTC on 6 October, is viewed on a device set to `Asia/Kolkata`
- **THEN** it is shown on 7 October, the device's local day

### Requirement: "Today" follows the current device
Anything that depends on the current day SHALL use the time zone of the device
making the request. This covers the Calendar's starting day and release
window, the Stats heatmap's one-year window, and which new-release
notifications fall in the window and count as unread.

#### Scenario: Calendar just after midnight local time
- **WHEN** a user in `Asia/Kolkata` opens the Calendar at 00:30 local time on 7 October (19:00 UTC on 6 October)
- **THEN** the Calendar treats 7 October as today

#### Scenario: Notification checked late in the local evening
- **WHEN** a user in `America/New_York` last checked notifications at 23:00 local time on 6 October (03:00 UTC on 7 October), and a followed person has a release dated 7 October
- **THEN** after local midnight that release is shown as unread

### Requirement: The Watched page shows a logged time zone that differs
On the Watched page, an entry logged in a time zone whose offset differs from
the current device's offset at that moment SHALL show its date followed by a
short label for the logged time zone. An entry logged in the device's own
time zone, or with no logged time zone, SHALL show only the date. Dates SHALL
keep the app's `dd-mm-yyyy` format.

#### Scenario: Entry logged abroad
- **WHEN** a user on a device set to `Europe/London` views an entry logged in `Asia/Kolkata`
- **THEN** the entry shows its Kolkata date followed by a time zone label, e.g. `07-10-2026 · GMT+5:30`

#### Scenario: Entry logged on this device's zone
- **WHEN** the entry was logged in the device's own time zone
- **THEN** only the date is shown
