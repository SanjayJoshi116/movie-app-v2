# theme-readability Specification

## Purpose

Makes page text and UI chrome readable in both the light and dark themes, so switching theme never leaves labels, legends or tooltips washed out against the background.

## Requirements

### Requirement: Stats page is readable in both themes
The Stats page SHALL render its stat-card labels and suffixes, heatmap month
and legend labels, empty heatmap cells, chart and heatmap tooltips, and poster
captions in colors derived from the active theme. In light mode, none of these
SHALL be drawn as white or near-white text or fills on the light background. In
dark mode, they SHALL look as they did before this change.

#### Scenario: Light mode labels
- **WHEN** a user with watched titles opens Stats in light mode
- **THEN** the stat-card labels, heatmap "Less"/"More" legend and month labels are dark text that is clearly readable on the light background

#### Scenario: Light mode empty heatmap cells
- **WHEN** the heatmap shows days with no activity in light mode
- **THEN** those cells are visible as a light gray grid, not invisible white-on-white

#### Scenario: Tooltip in light mode
- **WHEN** the user hovers a chart point or heatmap cell in light mode
- **THEN** the tooltip's background and text follow the light theme and are readable

#### Scenario: Dark mode unchanged
- **WHEN** a user opens Stats in dark mode
- **THEN** labels, legend, cells and tooltips look the same as before this change

### Requirement: Icons, captions and placeholders follow the active theme
The idle watched and watchlist icons on title cards, detail pages, Search, Watchlist and For You SHALL use the theme's accent in dark mode and the theme's text color in light mode, and the watchlist icon of a title in the watchlist SHALL use the same "in watchlist" color everywhere, detail pages included. Empty-state icons, muted card captions, filter chip borders and the no-poster placeholder SHALL take their colors from the active theme, so each is readable on that theme's background. The detail page's backdrop fade SHALL blend into the active theme's background. Text drawn on a fill that is the same in both themes (a gold badge, an avatar color) MAY keep a fixed color that contrasts with that fill.

#### Scenario: Light mode card icons
- **WHEN** a user in light mode views a movie card they haven't watched or added
- **THEN** its watched and watchlist icons use the light theme's text color, not pure black

#### Scenario: Light mode empty state
- **WHEN** a user in light mode sees an empty search, Calendar or For You result
- **THEN** the empty-state icon uses a muted color from the light theme, not a fixed light gray

#### Scenario: Missing poster in light mode
- **WHEN** a title without a poster is shown in light mode
- **THEN** its placeholder uses a light fill and readable text from the light theme, not a dark navy block

#### Scenario: Detail page watchlist icon
- **WHEN** a user in light mode opens a movie that isn't in their watchlist, then adds it
- **THEN** the icon first uses the light theme's text color, then the same "in watchlist" color as on title cards

#### Scenario: Detail backdrop in light mode
- **WHEN** a user in light mode opens a movie with a backdrop image
- **THEN** the backdrop fades into the light background, not into dark navy
