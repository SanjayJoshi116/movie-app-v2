## MODIFIED Requirements

### Requirement: CI fails on any lint warning
CI SHALL run the project's ESLint configuration over the frontend source and the TypeScript e2e specs, and SHALL fail on any error or warning in either.

#### Scenario: Unused import
- **WHEN** a pull request leaves an unused import in a page component
- **THEN** the CI run fails at the lint step

#### Scenario: Lint problem in an e2e spec
- **WHEN** a pull request leaves an unused variable in `e2e/stats.spec.ts`
- **THEN** the CI run fails at the lint step

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

## ADDED Requirements

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
