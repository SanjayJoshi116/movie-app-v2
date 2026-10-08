## ADDED Requirements

### Requirement: Other record dates follow the display convention
A list's creation date SHALL be shown as the device's local calendar day of when it was created, in `dd-mm-yyyy`. The Stats page's recently-watched dates SHALL be shown in `dd-mm-yyyy`.

#### Scenario: List created late in the evening
- **WHEN** a list was created at 23:30 local time on a day when UTC has already moved to the next date
- **THEN** the Lists page shows the local day of creation, not the UTC day

#### Scenario: Recently watched badge
- **WHEN** the Stats page lists a title watched on 15 January 2024
- **THEN** its date shows as `15-01-2024`, not `2024-01-15`
