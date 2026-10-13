# ci-pipeline Specification

## Purpose

Defines what a green CI run guarantees for every push and pull request to
`main`: which checks run, and what makes each one fail, so a passing pipeline
means the code compiles, lints clean, has in-sync migrations, and passes every
test suite the project maintains.

## Requirements

### Requirement: CI fails on type errors in app and e2e code
CI SHALL typecheck the frontend application code and the TypeScript e2e specs,
and SHALL fail when either has a type error.

#### Scenario: Type error in a spec
- **WHEN** a pull request introduces a type error in `e2e/movies.spec.ts`
- **THEN** the CI run fails at the typecheck step

### Requirement: CI fails on any lint warning
CI SHALL run the project's ESLint configuration over the frontend source and the TypeScript e2e specs, and SHALL fail on any error or warning in either.

#### Scenario: Unused import
- **WHEN** a pull request leaves an unused import in a page component
- **THEN** the CI run fails at the lint step

#### Scenario: Lint problem in an e2e spec
- **WHEN** a pull request leaves an unused variable in `e2e/stats.spec.ts`
- **THEN** the CI run fails at the lint step

### Requirement: CI fails when models and migrations are out of sync
CI SHALL fail when the Django models contain a change that has no migration.

#### Scenario: Model field added without a migration
- **WHEN** a pull request adds a field to a model but no migration
- **THEN** the CI run fails at the migration check step

### Requirement: CI runs both end-to-end suites
CI SHALL run the Python Playwright suite and the TypeScript Playwright suite
(desktop and mobile projects) against the frontend with all API calls mocked.
CI SHALL fail when any test in either suite fails. A failed test SHALL NOT be re-run
into a pass. The suites SHALL NOT depend on a developer-machine path or tool to start.

#### Scenario: TypeScript e2e regression
- **WHEN** a pull request breaks the login form so a TypeScript e2e test fails
- **THEN** the CI run fails at the TypeScript e2e step

#### Scenario: Fresh runner
- **WHEN** CI starts the TypeScript e2e suite on a clean Linux runner
- **THEN** the frontend starts without any Windows path or port-killing tool

#### Scenario: Flaky test
- **WHEN** a TypeScript e2e test fails on its first attempt and would pass on a second
- **THEN** the CI run fails, and the failure's trace is kept for download

### Requirement: CI uses a supported Node.js release
Every CI job that installs Node.js SHALL use a Node.js release that is within
its upstream support window.

#### Scenario: Node version in CI
- **WHEN** any CI job sets up Node.js
- **THEN** it uses an active or maintenance LTS release, not an end-of-life one

### Requirement: CI build environment carries no unused secrets
The frontend build step SHALL NOT receive secrets the build does not read.

#### Scenario: TMDB key
- **WHEN** CI builds the frontend bundle
- **THEN** no TMDB API key is passed to that step

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

### Requirement: CI runs the frontend unit tests
CI SHALL run the frontend unit test suite and SHALL fail when any test fails or when the suite finds no tests at all.

#### Scenario: Test discovery broken
- **WHEN** a configuration change makes the unit test runner find zero test files
- **THEN** the CI run fails at the unit test step instead of passing

### Requirement: CI builds the production images
CI SHALL build the backend and frontend production images on every run, and SHALL fail when either build fails. CI SHALL start the built frontend image and fail unless its web server sends the security headers, revalidates the entry page, returns 404 for a missing static asset, and serves a hashed asset compressed with a long-lived cache.

#### Scenario: Broken Dockerfile
- **WHEN** a pull request changes a Dockerfile so the image no longer builds
- **THEN** the CI run fails at the image build step

#### Scenario: Web server configuration that won't load
- **WHEN** a pull request leaves `nginx.conf` with a directive nginx rejects
- **THEN** the CI run fails when it starts the frontend image
