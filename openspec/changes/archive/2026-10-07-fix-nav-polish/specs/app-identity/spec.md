## ADDED Requirements

### Requirement: App icons show CINE DB branding
The browser-tab favicon, the Apple touch icon and every icon listed in the web app manifest SHALL show CINE DB branding. They SHALL NOT be the Create React App default React logo. Each icon file SHALL match the pixel size the manifest declares for it.

#### Scenario: Browser tab
- **WHEN** the app is opened in a browser
- **THEN** the tab's favicon is the CINE DB icon, not the React logo

#### Scenario: Install as an app
- **WHEN** a user installs the site as an app, or adds it to a phone home screen
- **THEN** the launcher icon is the CINE DB icon at the declared 192×192 or 512×512 size
