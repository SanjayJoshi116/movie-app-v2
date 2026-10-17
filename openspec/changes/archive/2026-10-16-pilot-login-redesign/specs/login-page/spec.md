## ADDED Requirements

### Requirement: Sign-in page presents the CINE DB identity
The sign-in page SHALL show the CINE DB name as a wordmark and a one-line tagline above the sign-in form, in both the dark and the light theme. All text on the page SHALL meet a contrast ratio of at least 4.5:1 against the background behind it, and the page SHALL fit a 320px-wide viewport without horizontal scrolling. Decorative motion on the page SHALL NOT play when the user has asked for reduced motion. The form's field labels, button name and links SHALL stay as they are.

#### Scenario: Wordmark and tagline in either theme
- **WHEN** a signed-out user opens `/login` in the dark theme, and again in the light theme
- **THEN** the page shows the "CINE DB" wordmark and a tagline above a form with "Username" and "Password" fields and a "Sign In" button

#### Scenario: Text stays readable
- **WHEN** the sign-in page is rendered in either theme
- **THEN** every visible text element, the wordmark and tagline included, measures at least 4.5:1 against its rendered background

#### Scenario: Narrow phone
- **WHEN** the sign-in page is opened in a 320px-wide viewport
- **THEN** the page has no horizontal scroll and the form is fully visible within the viewport width

#### Scenario: Reduced motion
- **WHEN** the user's system asks for reduced motion and the sign-in page opens
- **THEN** no decorative animation or transition runs on the page

#### Scenario: Page title unchanged
- **WHEN** the sign-in page opens
- **THEN** the browser tab is titled "Sign In · CINE DB"
