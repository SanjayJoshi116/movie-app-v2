## ADDED Requirements

### Requirement: Paginated pages request each page once per load
Loading a paginated browse or search grid, or restoring one on return, SHALL
request each needed page exactly once, including in the development build
(which mounts components twice to test effect cleanup).

#### Scenario: Restore three pages in development
- **WHEN** the user returns to a browse page that had 3 pages loaded, running under `npm run dev`
- **THEN** pages 1, 2 and 3 are each requested once

#### Scenario: First load in development
- **WHEN** the user opens a browse page fresh under `npm run dev`
- **THEN** page 1 is requested once
