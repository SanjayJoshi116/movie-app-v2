## ADDED Requirements

### Requirement: Every tool and action CI runs is pinned
Every tool CI installs or runs SHALL come from a pinned version recorded in the repository: npm tools through the lockfile, Python packages through a constraints file, and third-party actions by commit SHA. The Playwright version used by the Python e2e suite SHALL equal the one used by the TypeScript e2e suite, and CI SHALL fail when they differ.

#### Scenario: New release of a helper tool
- **WHEN** a new version of the tool CI uses to wait for the dev server is published
- **THEN** CI keeps using the locked version

#### Scenario: Playwright versions drift
- **WHEN** a pull request bumps `@playwright/test` in `package.json` without bumping the Python `playwright` pin
- **THEN** CI fails, naming both versions

#### Scenario: A moved action tag
- **WHEN** an action's version tag is moved to a different commit upstream
- **THEN** CI still runs the commit it was pinned to

### Requirement: The workflow token is read-only
The CI workflow SHALL grant its `GITHUB_TOKEN` read access to repository contents only, unless a job declares a wider permission it needs.

#### Scenario: Default permissions
- **WHEN** a CI job runs
- **THEN** its token can read the repository and cannot write to it

### Requirement: A failed Python e2e run leaves its traces
When the Python e2e job fails, CI SHALL upload the Playwright traces of the failed tests as a run artifact, as the TypeScript e2e job does.

#### Scenario: One failing Python e2e test
- **WHEN** a Python e2e test fails in CI
- **THEN** the run has an artifact with that test's trace
