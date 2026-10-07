## Purpose

Defines what a green CI run guarantees for every push and pull request to
`main`: which checks run, and what makes each one fail, so a passing pipeline
means the code compiles, lints clean, has in-sync migrations, and passes every
test suite the project maintains.

## ADDED Requirements

### Requirement: CI fails on type errors in app and e2e code
CI SHALL typecheck the frontend application code and the TypeScript e2e specs,
and SHALL fail when either has a type error.

#### Scenario: Type error in a spec
- **WHEN** a pull request introduces a type error in `e2e/movies.spec.ts`
- **THEN** the CI run fails at the typecheck step

### Requirement: CI fails on any lint warning
CI SHALL run the project's ESLint configuration over the frontend source and
SHALL fail on any error or warning.

#### Scenario: Unused import
- **WHEN** a pull request leaves an unused import in a page component
- **THEN** the CI run fails at the lint step

### Requirement: CI fails when models and migrations are out of sync
CI SHALL fail when the Django models contain a change that has no migration.

#### Scenario: Model field added without a migration
- **WHEN** a pull request adds a field to a model but no migration
- **THEN** the CI run fails at the migration check step

### Requirement: CI runs both end-to-end suites
CI SHALL run the Python Playwright suite and the TypeScript Playwright suite
(desktop and mobile projects) against the frontend with all API calls mocked.
CI SHALL fail when any test in either suite fails. The suites SHALL NOT depend
on a developer-machine path or tool to start.

#### Scenario: TypeScript e2e regression
- **WHEN** a pull request breaks the login form so a TypeScript e2e test fails
- **THEN** the CI run fails at the TypeScript e2e step

#### Scenario: Fresh runner
- **WHEN** CI starts the TypeScript e2e suite on a clean Linux runner
- **THEN** the frontend starts without any Windows path or port-killing tool

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
