## ADDED Requirements

### Requirement: Sign-in pages are recognised however the address is written
The sign-in, register and forgot-password pages SHALL be treated as sign-in pages whatever the letter case of their address and with or without a trailing slash, both when sending a signed-in user on from them and when choosing where to go after signing in.

#### Scenario: Trailing slash while signed in
- **WHEN** a signed-in user opens `/login/`
- **THEN** they land on Movies (or the page they were redirected from), and the login form is never shown

#### Scenario: Upper case while signed out
- **WHEN** a signed-out user opens `/LOGIN` and signs in
- **THEN** they land on Movies, not back on the login form
