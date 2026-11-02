## ADDED Requirements

### Requirement: The list page is titled with its state
A list page SHALL be titled with the list's name once it loads. When the list doesn't exist it SHALL be titled with its not-found heading ("List not found"), and when the lists failed to load, with its error heading ("Couldn't load your lists"), not the generic "List".

#### Scenario: Unknown list
- **WHEN** a user opens `/lists/999999` and their lists loaded without it
- **THEN** the tab reads "List not found · CINE DB"

#### Scenario: Lists failed to load
- **WHEN** loading the user's lists fails on a list page
- **THEN** the tab reads "Couldn't load your lists · CINE DB"
