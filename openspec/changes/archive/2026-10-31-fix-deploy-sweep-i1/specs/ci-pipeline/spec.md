## MODIFIED Requirements

### Requirement: CI builds the production images
CI SHALL build the backend and frontend production images on every run, and SHALL fail when either build fails. CI SHALL start the built frontend image and fail unless its web server sends the security headers, revalidates the entry page, returns 404 for a missing static asset, serves a hashed asset compressed with a long-lived cache, and sends `no-referrer` for the password-reset and TMDB-callback pages. CI SHALL also run the backend's deployment checks inside the built backend image, with debug mode off and placeholder production settings, and fail when they report an error or the code it ships can't load.

#### Scenario: Broken Dockerfile
- **WHEN** a pull request changes a Dockerfile so the image no longer builds
- **THEN** the CI run fails at the image build step

#### Scenario: Web server configuration that won't load
- **WHEN** a pull request leaves `nginx.conf` with a directive nginx rejects
- **THEN** the CI run fails when it starts the frontend image

#### Scenario: Runtime code imports a file the image leaves out
- **WHEN** a pull request makes application code import a test or development-only module that the backend image excludes
- **THEN** the CI run fails at the backend image check

#### Scenario: Setting that fails only in production mode
- **WHEN** a pull request adds a setting that raises a configuration error only with debug mode off
- **THEN** the CI run fails at the backend image check

### Requirement: Every tool and action CI runs is pinned
Every tool CI installs or runs SHALL come from a pinned version recorded in the repository: npm tools through the lockfile, Python packages through a constraints file, third-party actions by commit SHA, service containers by exact version and content digest, and the Node.js and Python runtimes by exact version, equal to the versions the production images use. The Playwright version used by the Python e2e suite SHALL equal the one used by the TypeScript e2e suite, and CI SHALL fail when they differ. The backend test suite SHALL fail when a CI service image lacks a digest or a runtime version differs from its image's.

#### Scenario: New release of a helper tool
- **WHEN** a new version of the tool CI uses to wait for the dev server is published
- **THEN** CI keeps using the locked version

#### Scenario: Playwright versions drift
- **WHEN** a pull request bumps `@playwright/test` in `package.json` without bumping the Python `playwright` pin
- **THEN** CI fails, naming both versions

#### Scenario: A moved action tag
- **WHEN** an action's version tag is moved to a different commit upstream
- **THEN** CI still runs the commit it was pinned to

#### Scenario: Database image republished upstream
- **WHEN** a new Postgres 15 image is published under the same minor tag
- **THEN** CI's backend job keeps using the image it was pinned to

#### Scenario: Runtime drifts from the image
- **WHEN** a pull request bumps the Node.js version in `Dockerfile.frontend` but not in the workflow
- **THEN** the backend test suite fails, naming both versions

## ADDED Requirements

### Requirement: Every CI job has a time cap
Every CI job SHALL declare a time limit a few minutes above its normal run time, so a hung step fails that job instead of holding a runner for hours.

#### Scenario: A test hangs
- **WHEN** a unit test in the frontend or backend job blocks forever
- **THEN** the job fails at its time limit, not after GitHub's six-hour default
