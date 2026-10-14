## ADDED Requirements

### Requirement: An older recompute never replaces a newer one
A recompute's result SHALL be stored only if no recompute that started later has already stored its result for that user. This SHALL hold across server processes.

#### Scenario: Two processes recompute the same user
- **WHEN** a recompute starts on one process, a watch on another process starts a second recompute that finishes and saves first, and then the first one finishes
- **THEN** the second recompute's result stays stored
