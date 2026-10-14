# dev-environment Specification

## Purpose

Defines how a developer configures and starts the local stack: which Python interpreter the dev scripts use, and which example files document every setting the backend reads, so a fresh checkout runs on any machine without editing tracked files.

## Requirements

### Requirement: The dev scripts take the backend interpreter from configuration
The scripts that start Django for local development (`npm run dev`, `npm start`, `npm run django`) SHALL use the Python interpreter named by the `DJANGO_PYTHON` setting, read from the environment first and then from the untracked root `.env` file. When neither sets it, they SHALL use `python` from the `PATH`. No tracked file SHALL contain a machine-specific interpreter path.

#### Scenario: Interpreter set in the root .env
- **WHEN** the root `.env` contains `DJANGO_PYTHON=<path to a Python with the backend's dependencies>` and the developer runs `npm run dev`
- **THEN** Django starts with that interpreter

#### Scenario: Environment overrides the .env file
- **WHEN** `DJANGO_PYTHON` is set both in the shell environment and in the root `.env`
- **THEN** the shell environment's value is used

#### Scenario: Nothing configured
- **WHEN** `DJANGO_PYTHON` is set nowhere
- **THEN** Django starts with `python` from the `PATH`

#### Scenario: Interpreter not found
- **WHEN** `DJANGO_PYTHON` names a file that doesn't exist
- **THEN** the script exits with a non-zero status and an error message that names `DJANGO_PYTHON` and the value it tried

#### Scenario: Django's exit is passed on
- **WHEN** the Django process exits with a non-zero status
- **THEN** the script exits with that status

### Requirement: Example env files list every backend setting
`backend/.env.example` SHALL mention every environment variable the backend's settings read, each with a comment saying whether it's required with debug off and what its default is. A variable that lives in another file (the Docker-only database password in `.env.db`) SHALL be mentioned with a pointer to that file. The root `.env.example` SHALL document `DJANGO_PYTHON`.

#### Scenario: A new setting without an example entry
- **WHEN** the backend's settings start reading an environment variable that `backend/.env.example` doesn't mention
- **THEN** the backend test suite fails and names the variable

#### Scenario: Settings fixed by the audit
- **WHEN** a developer reads `backend/.env.example`
- **THEN** it documents `FRONTEND_URL`, `JWT_SIGNING_KEY`, `CONN_MAX_AGE`, `DEFAULT_FROM_EMAIL` and `EMAIL_TIMEOUT`
