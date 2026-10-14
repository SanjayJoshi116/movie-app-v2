## MODIFIED Requirements

### Requirement: Marking seen is not undone by an earlier poll
After notifications are marked seen, a poll response for a request that started before the mark-seen request finished SHALL NOT bring back the unread badge or unread state. A poll that starts after the mark-seen request finished SHALL be shown as usual.

#### Scenario: Poll in flight while closing the dropdown
- **WHEN** a notifications poll is in flight, the user closes the dropdown (marking items seen), and the poll then responds with those items as unread
- **THEN** the badge stays cleared

#### Scenario: Poll starts while the mark-seen request is in flight
- **WHEN** the user closes the dropdown, a poll starts before the mark-seen request has finished, and the server answers that poll with the items still unread
- **THEN** the badge stays cleared, and the next poll after the mark-seen request finished is shown as usual
