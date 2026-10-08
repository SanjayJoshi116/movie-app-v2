## ADDED Requirements

### Requirement: Forms submit once per activation
While a form's submit request is in flight (registration, creating a list, editing a list), the submit control SHALL show a busy state, and repeated activation (double-click, a second Enter) SHALL NOT send another request. This holds wherever a list can be created, including the Add to List dialog's inline create.

#### Scenario: Double-click Register
- **WHEN** the user double-clicks Register with valid details
- **THEN** one registration request is sent, and no "username already exists" error appears over the successful signup

#### Scenario: Double-click OK on New List
- **WHEN** the user double-clicks OK in the New List dialog
- **THEN** exactly one list is created

#### Scenario: Double-click Save on list edit
- **WHEN** the user double-clicks Save in the list edit dialog
- **THEN** one update request is sent and one success message is shown

### Requirement: Error messages are readable
Every error message shown for a failed request SHALL be a readable sentence. When the server's response carries no usable message (for example an HTML error page from a proxy or a crashed worker), the message SHALL be the action's own failure message. When the server can't be reached or the request times out, the message SHALL say the server can't be reached.

#### Scenario: Proxy returns an HTML 502 page
- **WHEN** saving a rating gets a `502` whose body is an HTML page
- **THEN** the error says "Failed to save rating.", not a single character such as `<`

#### Scenario: Network failure
- **WHEN** a write fails because the server is unreachable or the request times out
- **THEN** the error says "Can't reach the server. Check your connection and try again."
