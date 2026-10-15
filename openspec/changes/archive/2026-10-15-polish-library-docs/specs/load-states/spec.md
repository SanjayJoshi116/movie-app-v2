## ADDED Requirements

### Requirement: A missing list shows the not-found state
Opening a list that doesn't exist (or belongs to someone else) SHALL show the not-found state used by movie, TV and person pages, with a way back to My Lists. A failed load of the lists SHALL still show the error with Retry, never the not-found state.

#### Scenario: Unknown list id
- **WHEN** a user opens `/lists/999999` and their lists loaded without it
- **THEN** a "List not found" state is shown with a link back to My Lists

#### Scenario: Lists failed to load
- **WHEN** loading the user's lists fails
- **THEN** the page shows the error with Retry, not "not found"
