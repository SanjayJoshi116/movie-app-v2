## ADDED Requirements

### Requirement: Marking seen is not undone by an earlier poll
After notifications are marked seen, a poll response for a request that started before the marking SHALL NOT bring back the unread badge or unread state. A poll that starts after the marking SHALL be shown as usual.

#### Scenario: Poll in flight while closing the dropdown
- **WHEN** a notifications poll is in flight, the user closes the dropdown (marking items seen), and the poll then responds with those items as unread
- **THEN** the badge stays cleared
