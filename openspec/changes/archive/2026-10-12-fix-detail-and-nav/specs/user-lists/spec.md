## ADDED Requirements

### Requirement: Add to List dialog starts clean and states its load state
Each time the Add to List dialog opens, its search box and new-list name SHALL be empty. While the user's lists are loading the dialog SHALL show a loading state, and when they failed to load it SHALL show an error with Retry. It SHALL say there are no lists yet only when the lists loaded and there are none.

#### Scenario: Reopening the dialog
- **WHEN** the user types a search in the dialog, closes it and opens it again
- **THEN** the search box is empty and every list is shown

#### Scenario: Lists failed to load
- **WHEN** the lists request failed and the user opens the dialog
- **THEN** the dialog shows an error with Retry, not "No lists yet"
