## ADDED Requirements

### Requirement: Malformed person photos hide only the Photos tab
When a person page's photos answer is missing, empty or malformed (no list of profile images, or an entry without an image path), the page SHALL render the person and their credits normally and SHALL hide the Photos tab or the malformed entries only.

#### Scenario: Photos answer without profiles
- **WHEN** a person loads and the photos request answers `200` with `{}` or `{"profiles": null}`
- **THEN** the person page renders with its credits and no Photos tab, and no error is shown
