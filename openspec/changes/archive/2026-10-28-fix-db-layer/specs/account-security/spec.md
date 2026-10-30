## ADDED Requirements

### Requirement: A password reset applies completely or not at all
Completing a password reset SHALL change the password, end the account's existing sessions and clear its failed-attempt count together. If any of these fails, none of them SHALL take effect, the old password SHALL keep working, and the reset link SHALL stay usable until it expires.

#### Scenario: Ending sessions fails
- **WHEN** a user submits a valid reset and ending their existing sessions fails with a database error
- **THEN** the request fails, the old password still signs in, and the same reset link can be used again

### Requirement: Deleting an account clears its failed-attempt count
Deleting an account SHALL clear the failed-attempt count for its username, so a new account registered with that username starts with no failed attempts.

#### Scenario: Username reused after deletion
- **WHEN** `alice` has failed sign-in attempts recorded, deletes her account, and someone registers a new account named `alice`
- **THEN** the new account's first sign-in with its correct password succeeds and is not limited
