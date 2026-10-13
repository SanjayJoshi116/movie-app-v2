## ADDED Requirements

### Requirement: An email address belongs to one account
Registration and profile updates SHALL NOT leave two accounts with the same email address (compared case-insensitively), even when two requests that use the same new address arrive at the same time. The later request SHALL be rejected with a field error on the email.

#### Scenario: Two accounts switch to one address at once
- **WHEN** two signed-in users submit a profile update changing their email to `same@example.com` at the same moment
- **THEN** exactly one update succeeds, and the other is rejected with an email error
