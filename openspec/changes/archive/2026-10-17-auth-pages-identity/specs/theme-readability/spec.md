## ADDED Requirements

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
