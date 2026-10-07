# app-identity Specification

## Purpose

Makes the browser tab, search snippet and installed-app (PWA) metadata identify the app as CINE DB instead of the Create React App template it was generated from.

## Requirements

### Requirement: Installed app is named CINE DB
The web app manifest SHALL name the app "CINE DB" in both its short and full
name. It SHALL NOT contain Create React App template names.

#### Scenario: Install as an app
- **WHEN** a user installs the site as an app from the browser
- **THEN** the install prompt and the installed app show "CINE DB", not "React App"

### Requirement: Page metadata describes the app
The HTML page SHALL carry a meta description that describes CINE DB. It SHALL
NOT contain the Create React App template description or template comments.

#### Scenario: Page source
- **WHEN** the served `index.html` is inspected
- **THEN** its meta description mentions tracking movies and TV shows, and it doesn't contain "create-react-app"

### Requirement: App icons show CINE DB branding
The browser-tab favicon, the Apple touch icon and every icon listed in the web app manifest SHALL show CINE DB branding. They SHALL NOT be the Create React App default React logo. Each icon file SHALL match the pixel size the manifest declares for it.

#### Scenario: Browser tab
- **WHEN** the app is opened in a browser
- **THEN** the tab's favicon is the CINE DB icon, not the React logo

#### Scenario: Install as an app
- **WHEN** a user installs the site as an app, or adds it to a phone home screen
- **THEN** the launcher icon is the CINE DB icon at the declared 192×192 or 512×512 size
