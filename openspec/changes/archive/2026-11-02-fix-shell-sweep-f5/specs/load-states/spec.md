## ADDED Requirements

### Requirement: A page that fails to render keeps the app usable
Every route, including the sign-in, register, password, TMDB callback and not-found pages, SHALL show its own error state inside the app's layout and theme when it fails to render or its code fails to load. The rest of the app (navigation, theme) SHALL stay in place. State restored from browser history that isn't in the expected shape SHALL be ignored, not crash the app.

#### Scenario: Stale page code after a deploy
- **WHEN** a tab opened before a deploy navigates to `/tmdb-callback` and that page's code fails to load
- **THEN** an error with a reload action is shown in the app's theme, not a blank or unstyled full-page error

#### Scenario: Malformed restored Anime state
- **WHEN** the user goes Back to an `/anime` history entry whose saved category isn't text
- **THEN** the Anime page opens in its default mode and the app keeps working
