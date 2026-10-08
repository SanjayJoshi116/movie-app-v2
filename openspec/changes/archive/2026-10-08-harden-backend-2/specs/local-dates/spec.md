## MODIFIED Requirements

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

#### Scenario: Zone name that is a tzdata directory
- **WHEN** a request to the stats, notifications or mark-watched endpoint (or a watched import entry) carries `America`, `Etc` or `America/Argentina` as its time zone
- **THEN** the request succeeds, its dates are computed in UTC, and a stored watch records no zone
