## ADDED Requirements

### Requirement: Unknown query values fall back to defaults
A page that reads a tab, page number or page size from the address SHALL treat a missing, unknown or malformed value as its default. The Stats and Search pages SHALL show their default tab for an unknown `tab`. The Watched page SHALL accept only a whole-number `page` of at least 1 and a `pageSize` among the sizes it offers, and SHALL show the first page at the default size otherwise.

#### Scenario: Unknown Stats tab
- **WHEN** a user opens `/stats?tab=nope`
- **THEN** the Stats page shows its default tab, not a blank panel

#### Scenario: Unknown Search tab
- **WHEN** a user opens a search address with `tab=nope`
- **THEN** the Search page shows its Movies tab

#### Scenario: Negative or fractional Watched page
- **WHEN** a user opens `/watched?page=-2` or `/watched?page=1.5`
- **THEN** the Watched page shows its first page, starting with the newest watch

#### Scenario: Unsupported page size
- **WHEN** a user opens `/watched?pageSize=-5`
- **THEN** the Watched page shows the default page size
