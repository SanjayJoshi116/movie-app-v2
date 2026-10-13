## ADDED Requirements

### Requirement: Icons, captions and placeholders follow the active theme
The idle watched and watchlist icons on title cards, detail pages, Search, Watchlist and For You SHALL use the theme's accent in dark mode and the theme's text color in light mode. Empty-state icons, muted card captions, filter chip borders and the no-poster placeholder SHALL take their colors from the active theme, so each is readable on that theme's background. Text drawn on a fill that is the same in both themes (a gold badge, an avatar color) MAY keep a fixed color that contrasts with that fill.

#### Scenario: Light mode card icons
- **WHEN** a user in light mode views a movie card they haven't watched or added
- **THEN** its watched and watchlist icons use the light theme's text color, not pure black

#### Scenario: Light mode empty state
- **WHEN** a user in light mode sees an empty search, Calendar or For You result
- **THEN** the empty-state icon uses a muted color from the light theme, not a fixed light gray

#### Scenario: Missing poster in light mode
- **WHEN** a title without a poster is shown in light mode
- **THEN** its placeholder uses a light fill and readable text from the light theme, not a dark navy block
