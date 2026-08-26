# login-page Specification

## Purpose

Defines the client-side behavior of the login form: how field values are
retained or cleared around a login attempt, how failure causes map to the
message shown to the user, and how the form's inputs behave while a request
is in flight.

## Requirements

### Requirement: Username is preserved after a failed login
When a login attempt fails for any reason, the system SHALL retain the
username the user entered and SHALL clear only the password field, moving
focus to it so the user can immediately retry.

#### Scenario: Wrong password
- **WHEN** the user submits a username and password and the server responds
  with an authentication failure
- **THEN** the username field still shows the value the user typed, the
  password field is empty, and focus is on the password field

### Requirement: Error message reflects the failure cause
The system SHALL show a distinct, accurate message for each of three failure
categories: invalid credentials, rate limiting, and inability to reach the
server.

#### Scenario: Invalid credentials
- **WHEN** the login request receives a `400` or `401` response
- **THEN** the system shows "Invalid username or password."

#### Scenario: Rate limited
- **WHEN** the login request receives a `429` response
- **THEN** the system shows "Too many login attempts. Please wait a moment
  and try again."

#### Scenario: Server unreachable
- **WHEN** the login request fails with no response (network error) or with
  a `5xx` response
- **THEN** the system shows "Can't reach the server. Check your connection
  and try again." and does NOT show the invalid-credentials message

### Requirement: Username is autofocused and trimmed
The system SHALL place initial keyboard focus on the username field when the
login page loads, and SHALL trim leading/trailing whitespace from the
username before submitting the login request.

#### Scenario: Page loads
- **WHEN** the login page finishes rendering
- **THEN** the username input has focus without any user interaction

#### Scenario: Username has surrounding whitespace
- **WHEN** the user submits a username with leading or trailing spaces (e.g.
  from mobile autocomplete) and an otherwise-correct password
- **THEN** the system submits the trimmed username to the login request

### Requirement: Inputs are locked while a login request is in flight
The system SHALL disable the username field, password field, and submit
button for the duration of an in-flight login request, re-enabling them once
the request settles (success or failure).

#### Scenario: Slow login request
- **WHEN** the user submits the form and the login request has not yet
  resolved
- **THEN** the username field, password field, and submit button are all
  disabled until the request resolves
