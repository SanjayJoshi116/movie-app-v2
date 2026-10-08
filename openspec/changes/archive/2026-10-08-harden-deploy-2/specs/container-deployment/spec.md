## ADDED Requirements

### Requirement: A redeploy never strands an open tab on a blank page
After a new frontend version is deployed, the app's entry page SHALL be revalidated on every load, so browsers don't keep an old copy pointing at chunks that no longer exist. A request for a static asset that doesn't exist SHALL get a not-found response, never the app's HTML. All security headers SHALL still be sent on every response.

#### Scenario: Tab opened before the deploy
- **WHEN** a user reloads the app after a deploy that removed the previous build's hashed chunks
- **THEN** the browser fetches the new entry page and its new chunks, and the app renders

#### Scenario: Old chunk requested
- **WHEN** a browser requests `/static/js/main.<old-hash>.js`, which no longer exists
- **THEN** the response is a 404, not `index.html` with status 200

#### Scenario: Headers kept
- **WHEN** the entry page or a static asset is served
- **THEN** the response carries the same security headers (CSP, `nosniff`, frame and referrer policies) as before this change

### Requirement: The database container receives only its own secret
The database container SHALL receive only the settings it needs (its password, database name and user). It SHALL NOT receive the application's other secrets, such as the Django secret key, the TMDB API key or mail credentials. The database password SHALL be defined in one place, shared by the database and the backend. The stack SHALL start with a plain `docker compose up`, with no extra command-line flags.

#### Scenario: Inspecting the database container
- **WHEN** an operator lists the database container's environment
- **THEN** no application secret other than the database password is present

#### Scenario: No extra flags
- **WHEN** an operator has filled in the app's and the database's environment files and runs `docker compose up`
- **THEN** the database and the backend both start, and the backend connects using the same password the database was given

#### Scenario: Missing database secret file
- **WHEN** the database's environment file doesn't exist
- **THEN** compose refuses to start and names the missing file

### Requirement: Images exclude environment-file copies
A backend image build SHALL exclude every environment file except the committed example, including copies such as `.env.local` and `*.env.bak`.

#### Scenario: Stray copy in the build context
- **WHEN** `backend/.env.local` exists in the working tree and the backend image is built
- **THEN** the file is not in the image

### Requirement: The trusted proxy count is configurable per deploy
The number of trusted reverse proxies SHALL be settable from the deploy's environment, keeping the current single-proxy setting as the default.

#### Scenario: Deploy behind a TLS terminator
- **WHEN** an operator sets `TRUSTED_PROXY_COUNT=2` in the environment used by compose
- **THEN** the backend uses 2, so each client keeps its own rate-limit identity
