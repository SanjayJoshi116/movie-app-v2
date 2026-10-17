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

### Requirement: Secondary text meets AA contrast in both themes
Secondary and tertiary text (descriptions, captions, form hints, muted labels) SHALL have at least 4.5:1 contrast against every page, card and popup background of the active theme, in light and dark mode. Placeholders and disabled text are exempt. Icons that carry meaning SHALL keep at least 3:1.

#### Scenario: Light mode caption
- **WHEN** a user in light mode reads a card caption or a form hint in the profile dialog
- **THEN** its contrast with the background is at least 4.5:1

#### Scenario: Dark mode caption
- **WHEN** a user in dark mode reads the same caption
- **THEN** its contrast with the background is at least 4.5:1

### Requirement: Sidebar wordmark is readable in both themes
The sidebar's "CINE DB" wordmark, and the single-letter mark shown in the collapsed icon rail, SHALL use the brand gold in the dark theme and a darker brass in the light theme, and SHALL measure at least 4.5:1 against the sidebar background in each theme. Showing the wordmark SHALL NOT make the sidebar taller than its visible area at a 1366×768 viewport on any page.

#### Scenario: Light theme sidebar
- **WHEN** a signed-in user in light mode views any page at desktop width
- **THEN** the sidebar wordmark measures at least 4.5:1 against the sidebar background

#### Scenario: Dark theme sidebar
- **WHEN** a signed-in user in dark mode views any page at desktop width
- **THEN** the sidebar wordmark is gold and measures at least 4.5:1 against the sidebar background

#### Scenario: Collapsed rail
- **WHEN** the sidebar is shown as the icon rail, in either theme
- **THEN** the single-letter mark measures at least 4.5:1 against the sidebar background

#### Scenario: Sidebar fits at 1366×768
- **WHEN** a signed-in user opens a browse page (Movies, TV or Anime) at 1366×768
- **THEN** the sidebar shows no scrollbar of its own

### Requirement: Primary buttons and links are readable in both themes
Text on a primary (gold) button SHALL be dark and measure at least 4.5:1 against the button. Text links SHALL use the brand gold in the dark theme and the darker brass in the light theme instead of a default blue, and SHALL measure at least 4.5:1 against the background behind them. This SHALL hold on every page, signed in or not.

#### Scenario: Primary button text
- **WHEN** a page shows an enabled primary button, in either theme
- **THEN** its label is dark text that measures at least 4.5:1 against the gold button

#### Scenario: Links in light mode
- **WHEN** a page shows a text link in light mode
- **THEN** the link is brass, not blue, and measures at least 4.5:1 against its background

#### Scenario: Links in dark mode
- **WHEN** a page shows a text link in dark mode
- **THEN** the link is gold, not blue, and measures at least 4.5:1 against its background
