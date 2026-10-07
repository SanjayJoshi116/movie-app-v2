# routing Specification

## Purpose

Defines app-level route behavior that isn't owned by a single page: what an unknown address shows, and where signed-in users go when they open a page meant for signed-out users.

## Requirements

### Requirement: Unknown paths show a not-found page
A signed-in user who opens a path the app doesn't define SHALL see a "Page not
found" page that keeps the address they typed and offers a link back to
Movies. The app SHALL NOT silently redirect them elsewhere. A signed-out user
SHALL first be sent to sign in, and after signing in SHALL see the same
not-found page.

#### Scenario: Mistyped address
- **WHEN** a signed-in user opens `/moviez`
- **THEN** the address bar still shows `/moviez`, the page says it wasn't found, and a link leads to Movies

#### Scenario: Root path
- **WHEN** a user opens `/`
- **THEN** they land on Movies, as before

### Requirement: Signed-in users skip sign-in pages
A signed-in user who opens `/login`, `/register` or `/forgot-password` SHALL be
sent, without a history entry, to the original location they were redirected
from (path, query string and hash, the same rule the login page uses after a
successful sign-in) or to Movies when there is none. While the session is
still being restored, these pages SHALL NOT show their form. A password-reset
link SHALL stay usable when signed in.

#### Scenario: Bookmarked login page
- **WHEN** a signed-in user opens `/login` from a bookmark
- **THEN** they land on Movies, and pressing Back doesn't return to the login form

#### Scenario: No flash while restoring
- **WHEN** a signed-in user reloads `/login`
- **THEN** the login form is never shown before the redirect

#### Scenario: Reset link while signed in
- **WHEN** a signed-in user opens a `/reset-password/<uid>/<token>` link
- **THEN** the reset form is shown
