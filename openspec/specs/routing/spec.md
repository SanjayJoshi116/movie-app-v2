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

### Requirement: Detail routes with an invalid id show the not-found page
Movie, TV show and person pages SHALL accept only a positive integer id. Any other id SHALL show the not-found page without loading anything.

#### Scenario: Non-numeric id
- **WHEN** the user opens `/movie/abc` or `/person/-3`
- **THEN** the not-found page is shown and no data request is made for that id

#### Scenario: Valid id
- **WHEN** the user opens `/movie/550`
- **THEN** the movie page loads as before

### Requirement: Back on a detail page always stays in the app
The Back control on movie, TV show and person pages SHALL return to the page the user came from when the app opened it. When there is no earlier page in the app's own history (the page was opened in a new tab, from a bookmark or from another site), Back SHALL go to that page's section: Movies for a movie, TV Shows for a show, People for a person. It SHALL NOT leave the app or do nothing.

#### Scenario: Opened in a new tab
- **WHEN** a user Ctrl-clicks a movie card, and in the new tab presses the page's Back control
- **THEN** the Movies page opens

#### Scenario: Opened from inside the app
- **WHEN** a user opens a person from a movie's cast and presses Back
- **THEN** they return to that movie
