## MODIFIED Requirements

### Requirement: Error messages are readable
Every error message shown for a failed request SHALL be a readable sentence. When the server's response carries no usable message (for example an HTML error page from a proxy or a crashed worker), the message SHALL be the action's own failure message. When the server can't be reached or the request times out, the message SHALL say the server can't be reached. This SHALL hold on every page, including the register, forgot-password and reset-password pages, and a message SHALL NOT tell the user to check the backend or show a raw value such as `[object Object]`.

#### Scenario: Proxy returns an HTML 502 page
- **WHEN** saving a rating gets a `502` whose body is an HTML page
- **THEN** the error says "Failed to save rating.", not a single character such as `<`

#### Scenario: Network failure
- **WHEN** a write fails because the server is unreachable or the request times out
- **THEN** the error says "Can't reach the server. Check your connection and try again."

#### Scenario: Reset password while the server is unreachable
- **WHEN** the user submits a new password from a reset link and the request gets no response, or a `502` HTML page
- **THEN** the message says the server can't be reached (no response) or that the reset failed (`502`), not "Invalid or expired reset link."

#### Scenario: Forgot password while the server is unreachable
- **WHEN** the user requests a reset link and the server can't be reached
- **THEN** the message is "Can't reach the server. Check your connection and try again.", with no mention of the backend

#### Scenario: Register with a nested error body
- **WHEN** registration fails with a field error whose value isn't a plain string or list of strings
- **THEN** the message is a readable sentence (the field's message or "Registration failed."), never `[object Object]`
