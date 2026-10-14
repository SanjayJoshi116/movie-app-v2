## ADDED Requirements

### Requirement: Deleting a list from its card never opens it
The Delete control on a Lists page card SHALL ask for confirmation. Confirming SHALL delete the list and keep the user on the Lists page. Cancelling SHALL close the confirmation and keep the user on the Lists page. Neither SHALL open the list.

#### Scenario: Cancel the delete
- **WHEN** the user presses Delete on a list card and then Cancel
- **THEN** the confirmation closes, the user stays on the Lists page, and the list is unchanged

#### Scenario: Confirm the delete
- **WHEN** the user presses Delete on a list card and then confirms
- **THEN** a delete request is sent for that list, the card disappears, and the user stays on the Lists page
