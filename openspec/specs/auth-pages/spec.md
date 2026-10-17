# auth-pages Specification

## Purpose

The account pages around sign-in (create account, forgot password, reset password) present the same CINE DB identity as the sign-in page, so the whole account flow reads as one product in both themes.

## Requirements

### Requirement: Account pages present the CINE DB identity
The create-account page, the forgot-password page (its request form and its "Check Your Inbox" confirmation) and the reset-password page SHALL each show the "CINE DB" wordmark as the page's main heading and the same one-line tagline as the sign-in page, above a card that holds the page's own heading and content, in both the dark and the light theme. The forms' field labels, button names, links, messages and browser tab titles SHALL stay as they are.

#### Scenario: Create account in either theme
- **WHEN** a signed-out user opens `/register` in the dark theme, and again in the light theme
- **THEN** the page shows the "CINE DB" wordmark and the tagline above a card headed "Create Account" with the registration form and a "Sign In" link

#### Scenario: Forgot password, before and after sending
- **WHEN** a signed-out user opens `/forgot-password` and submits an email address
- **THEN** both the request form and the "Check Your Inbox" confirmation show the wordmark and tagline above the card

#### Scenario: Reset password
- **WHEN** a user opens a password reset link
- **THEN** the page shows the wordmark and tagline above a card headed "Reset Password" with the new-password form

#### Scenario: Reset link opened while signed in
- **WHEN** a signed-in user opens a password reset link
- **THEN** the reset page shows the same stage inside the app's content area, beside the navigation, without horizontal scrolling

#### Scenario: Titles unchanged
- **WHEN** each account page opens
- **THEN** the browser tab is titled "Create Account · CINE DB", "Forgot Password · CINE DB" or "Reset Password · CINE DB"

### Requirement: Account pages are readable, fit phones and respect reduced motion
On the create-account, forgot-password and reset-password pages, every visible text element SHALL measure at least 4.5:1 against the background behind it in both themes, the page SHALL fit a 320px-wide viewport without horizontal scrolling, and decorative motion SHALL NOT play when the user has asked for reduced motion.

#### Scenario: Text stays readable
- **WHEN** any of the account pages is rendered in either theme
- **THEN** the wordmark, tagline, card heading, labels, button text and links each measure at least 4.5:1 against their rendered background

#### Scenario: Narrow phone
- **WHEN** any of the account pages is opened in a 320px-wide viewport
- **THEN** the page has no horizontal scroll and its card is fully visible within the viewport width

#### Scenario: Reduced motion
- **WHEN** the user's system asks for reduced motion and an account page opens
- **THEN** no decorative animation or transition runs on the page
