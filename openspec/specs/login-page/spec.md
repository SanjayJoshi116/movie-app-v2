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

### Requirement: Post-login redirect preserves the full original location
When an unauthenticated user is sent to the login page from a protected page,
a successful login SHALL return them to that page's full original location:
path, query string and hash. When there is no original location, the user
SHALL land on the default browse page.

#### Scenario: Query string kept
- **WHEN** a signed-out user opens `/search?tab=people`, is redirected to login and signs in
- **THEN** the user lands on `/search?tab=people` with the People tab active

#### Scenario: Direct login
- **WHEN** the user opens `/login` directly and signs in
- **THEN** the user lands on `/movies`

### Requirement: Sign-in page presents the CINE DB identity
The sign-in page SHALL show the CINE DB name as a wordmark and a one-line tagline above the sign-in form, in both the dark and the light theme. All text on the page SHALL meet a contrast ratio of at least 4.5:1 against the background behind it, and the page SHALL fit a 320px-wide viewport without horizontal scrolling. On a phone whose screen is at least 568px tall, the page SHALL NOT scroll vertically, with the browser's address bar shown. Decorative motion on the page SHALL NOT play when the user has asked for reduced motion. The form's field labels, button name and links SHALL stay as they are.

#### Scenario: Wordmark and tagline in either theme
- **WHEN** a signed-out user opens `/login` in the dark theme, and again in the light theme
- **THEN** the page shows the "CINE DB" wordmark and a tagline above a form with "Username" and "Password" fields and a "Sign In" button

#### Scenario: Text stays readable
- **WHEN** the sign-in page is rendered in either theme
- **THEN** every visible text element, the wordmark and tagline included, measures at least 4.5:1 against its rendered background

#### Scenario: Narrow phone
- **WHEN** the sign-in page is opened in a 320px-wide viewport
- **THEN** the page has no horizontal scroll and the form is fully visible within the viewport width

#### Scenario: Phone fits without scrolling
- **WHEN** the sign-in page is opened on a phone at 320×568, 375×667 or 390×844, with the browser's address bar shown
- **THEN** the page has no vertical scroll and the whole form is visible

#### Scenario: Keyboard open on a phone
- **WHEN** the user focuses a field on the sign-in page on an Android phone and the keyboard leaves at least 330px of space above it
- **THEN** the form fits in that space without the page scrolling, and the page's main heading remains available to screen readers

#### Scenario: Reduced motion
- **WHEN** the user's system asks for reduced motion and the sign-in page opens
- **THEN** no decorative animation or transition runs on the page

#### Scenario: Page title unchanged
- **WHEN** the sign-in page opens
- **THEN** the browser tab is titled "Sign In · CINE DB"
