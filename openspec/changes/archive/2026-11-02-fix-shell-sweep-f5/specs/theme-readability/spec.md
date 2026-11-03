## ADDED Requirements

### Requirement: The page opens in the chosen theme
The page background and text SHALL be in the user's saved theme from the first paint after the app's code loads, before the app has rendered. A user with the dark theme (the default) SHALL NOT see a light page while the app loads.

#### Scenario: Reload in dark mode
- **WHEN** a user whose saved theme is dark reloads any page
- **THEN** the page background is dark from the first paint of the app, with no light flash before it

### Requirement: Browser UI follows the active theme
The browser's own UI colors SHALL follow the active theme: the mobile address bar color (`theme-color`), native form controls and popups (`color-scheme`), and scrollbars in browsers that don't support the WebKit scrollbar styles.

#### Scenario: Light theme on a phone
- **WHEN** a user switches to the light theme on a mobile browser
- **THEN** the address bar uses the light theme's background color, not navy

#### Scenario: Dark theme in Firefox
- **WHEN** a user with the dark theme opens a long page in Firefox
- **THEN** the page scrollbar uses dark colors
