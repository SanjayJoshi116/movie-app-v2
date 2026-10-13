## ADDED Requirements

### Requirement: Back on a detail page always stays in the app
The Back control on movie, TV show and person pages SHALL return to the page the user came from when the app opened it. When there is no earlier page in the app's own history (the page was opened in a new tab, from a bookmark or from another site), Back SHALL go to that page's section: Movies for a movie, TV Shows for a show, People for a person. It SHALL NOT leave the app or do nothing.

#### Scenario: Opened in a new tab
- **WHEN** a user Ctrl-clicks a movie card, and in the new tab presses the page's Back control
- **THEN** the Movies page opens

#### Scenario: Opened from inside the app
- **WHEN** a user opens a person from a movie's cast and presses Back
- **THEN** they return to that movie
