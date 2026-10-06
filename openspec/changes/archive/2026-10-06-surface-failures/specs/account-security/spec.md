## ADDED Requirements

### Requirement: Password fields in the profile dialog are not retained
The profile dialog's password inputs (the account-deletion confirmation password and the new-password field) SHALL be empty each time the dialog opens. The account-deletion password SHALL also be cleared after a failed deletion attempt.

#### Scenario: Reopening the profile dialog
- **WHEN** the user types into the account-deletion password field, closes the profile dialog and reopens it
- **THEN** the account-deletion password field is empty

#### Scenario: Failed account deletion
- **WHEN** an account-deletion attempt fails because the password is wrong
- **THEN** an error is shown and the password field is cleared
