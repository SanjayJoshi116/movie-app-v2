## ADDED Requirements

### Requirement: Lint tools are pinned
Every lint tool CI runs SHALL be installed at a pinned version, so a new upstream release can't fail CI on unchanged code.

#### Scenario: New linter release
- **WHEN** a new ruff version with extra rules is published
- **THEN** CI keeps using the pinned version until the pin is changed on purpose

### Requirement: CI builds the bundle that ships
CI's production build SHALL use the same build settings as the production image, including the setting that keeps the runtime chunk out of inline scripts for the content security policy.

#### Scenario: Inline script regression
- **WHEN** a change makes the production build emit an inline script
- **THEN** the CI build produces the same output the image would, so the CSP-breaking bundle is the one under test

### Requirement: The project declares its Node.js version
The repository SHALL declare the Node.js major version it is built and tested with, matching CI and the production image, so local setups and tooling pick the same release.

#### Scenario: Fresh checkout
- **WHEN** a developer runs a version manager or `npm install` in a fresh checkout
- **THEN** the declared version is Node.js 22, the same as CI and the frontend image
