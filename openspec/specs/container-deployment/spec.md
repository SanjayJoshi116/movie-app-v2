# container-deployment Specification

## Purpose

Defines how the production Docker deployment is built and run: what the images contain, which user the backend runs as, how the database schema is brought up at boot, the security headers every response carries, and what the production API renders, so the documented "production stack" is safe to expose.

## Requirements

### Requirement: Images contain no user uploads or local state
The backend image SHALL NOT contain any file from the local uploads folder,
local databases or test/tool caches. Uploaded files SHALL live only in the
media volume.

#### Scenario: Developer has local avatars
- **WHEN** the backend image is built from a checkout whose `backend/media/avatars/` contains uploaded files
- **THEN** the image's media directory is empty

### Requirement: The backend runs as an unprivileged user
The backend container's processes SHALL run as a non-root user. That user
SHALL be able to write to the media volume, so avatar uploads keep working.

#### Scenario: Process identity
- **WHEN** the stack is running and the backend container's user is inspected
- **THEN** it is not root (uid is not 0)

#### Scenario: Avatar upload
- **WHEN** a user uploads an avatar to a freshly created deployment
- **THEN** the upload succeeds and the file is served back under `/media/`

### Requirement: The schema comes only from the image's migrations
At boot, the backend SHALL apply the migrations shipped in its image and
nothing else. It SHALL NOT create tables outside the migration history, and it
SHALL NOT read migrations from the host checkout.

#### Scenario: Host checkout differs from the image
- **WHEN** the host's `backend/userdata/migrations/` contains a migration that isn't in the built image
- **THEN** the running backend neither sees nor applies it

### Requirement: Every response carries a content security policy
Every response the site serves SHALL include a Content-Security-Policy that:
- allows scripts only from the site's own origin (no inline scripts)
- allows images only from the site's own origin, `data:`, TMDB's image host and the trailer thumbnail host (`https://i.ytimg.com`)
- allows fonts and stylesheets from the site's own origin and the font provider the app uses
- allows framing only of the trailer embed host, and lets the site be framed only by itself
- forbids plugins (`object-src 'none'`)

Every page of the app SHALL work under this policy without violations.

#### Scenario: App pages load cleanly
- **WHEN** a user browses Movies, a movie detail page with a trailer (thumbnail shown, then played), Stats and their profile with an avatar
- **THEN** posters, fonts, the trailer thumbnail, the trailer and the avatar all load, and the browser reports no CSP violations

#### Scenario: Injected inline script
- **WHEN** a page somehow contains an inline `<script>` that isn't part of the build
- **THEN** the browser refuses to run it

### Requirement: HSTS is sent only over HTTPS
The site SHALL send `Strict-Transport-Security` on responses to requests that
reached the deployment over HTTPS (as reported by the TLS terminator in front
of it). It SHALL NOT send it on plain-HTTP requests.

#### Scenario: Behind a TLS terminator
- **WHEN** a request arrives with `X-Forwarded-Proto: https`
- **THEN** the response includes `Strict-Transport-Security` with a max-age of at least 180 days

#### Scenario: Plain-HTTP LAN deployment
- **WHEN** a request arrives over plain HTTP with no `X-Forwarded-Proto: https`
- **THEN** the response has no `Strict-Transport-Security` header

### Requirement: The production API renders JSON only
With `DEBUG` off, API endpoints SHALL respond with JSON regardless of the
request's `Accept` header. They SHALL NOT serve the browsable HTML API, whose
static assets aren't served in production.

#### Scenario: Browser opens an API URL
- **WHEN** a browser requests `/api/health/` with `Accept: text/html` against a production deployment
- **THEN** the response is JSON

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

### Requirement: Access logs don't record one-time credentials
The web server's logs SHALL NOT contain password-reset tokens or TMDB request tokens, either in the request line or in the referer. In the access log, requests to `/reset-password/…` and `/tmdb-callback` SHALL be logged with those parts replaced by a placeholder, and every other request SHALL be logged as before. Pages served at `/reset-password/…` and `/tmdb-callback` SHALL be sent with a referrer policy of `no-referrer`, so requests those pages make carry no referer at all and an error-log line about one of them can't record a token. Every other page SHALL keep the `strict-origin-when-cross-origin` policy.

#### Scenario: Reset link opened
- **WHEN** a user opens a password-reset link
- **THEN** the access log line shows `/reset-password/` followed by the placeholder, not the uid or token

#### Scenario: Reset page calls the API
- **WHEN** the reset page sends its API request
- **THEN** the request carries no referer, and the access log line for it doesn't contain the token

#### Scenario: Backend down while a reset is submitted
- **WHEN** the reset page's API request fails because the backend can't be reached and the web server logs an error for it
- **THEN** the error log line doesn't contain the reset uid or token

#### Scenario: TMDB callback
- **WHEN** a user returns to `/tmdb-callback?request_token=…&approved=true`
- **THEN** the page is served with `Referrer-Policy: no-referrer`, and neither log line contains the request token

#### Scenario: Other pages
- **WHEN** any other page is served
- **THEN** its referrer policy is `strict-origin-when-cross-origin`

### Requirement: Static assets are compressed and cached by content hash
The production web server SHALL compress the app's own text assets (the entry page, scripts, stylesheets, JSON and SVG) for clients that accept it. Build assets whose file names carry a content hash SHALL be served with a cache lifetime of one year marked immutable. A missing asset's 404 SHALL NOT carry that cache lifetime. The entry page SHALL still be revalidated on every load, and every response SHALL keep the same security headers. API and user-media responses SHALL keep their current encoding and caching.

#### Scenario: Main bundle download
- **WHEN** a browser that accepts gzip requests `/static/js/main.<hash>.js`
- **THEN** the response is gzip-compressed and carries `Cache-Control: public, max-age=31536000, immutable`

#### Scenario: Missing chunk not cached
- **WHEN** a browser requests a `/static/` file that doesn't exist
- **THEN** the response is a 404 without the long-lived cache header

#### Scenario: Entry page after a deploy
- **WHEN** a browser loads any app route
- **THEN** the entry page is served with `Cache-Control: no-cache`, so a redeploy is picked up on the next load

#### Scenario: Headers kept on cached assets
- **WHEN** a hashed static asset is served
- **THEN** it carries the same security headers (CSP, `nosniff`, frame and referrer policies) as the entry page

### Requirement: Images build from pinned bases and carry only runtime files
Every image the stack builds or runs SHALL name its base image by exact version and content digest, so a rebuild of an unchanged repository uses the same base. The backend image SHALL NOT contain the backend's tests, test configuration or development-only startup files. Image build contexts SHALL NOT include version-control data, local tool state, specifications or documentation.

#### Scenario: Upstream base image republished
- **WHEN** a new `python:3.12-slim` image is published upstream and the backend image is rebuilt from the same commit
- **THEN** the build uses the same base image as before

#### Scenario: Backend image contents
- **WHEN** the backend image is built
- **THEN** it contains no `tests` directory, `conftest.py`, `pytest.ini` or test requirements file

### Requirement: The web server doesn't advertise its version
Responses from the frontend web server SHALL NOT state the server software's version, in headers or error pages.

#### Scenario: Error page
- **WHEN** a request for a missing static file gets a 404
- **THEN** neither the `Server` header nor the page body contains an nginx version number

### Requirement: The web server finds a recreated backend
The web server SHALL look up the backend's address while it runs, not only when it starts, so recreating or restarting the backend container alone doesn't leave API and media requests failing.

#### Scenario: Backend recreated on redeploy
- **WHEN** only the backend container is rebuilt and recreated, and it comes back at a different address
- **THEN** API and media requests reach the new container within seconds, without restarting the frontend container

#### Scenario: Web server starts before the backend is resolvable
- **WHEN** the frontend container starts while the name `backend` doesn't resolve
- **THEN** the web server still starts and serves the app's pages

### Requirement: The forwarded scheme is normalized
The web server SHALL forward to the backend a request scheme of exactly `https` or `http`: `https` only when the incoming `X-Forwarded-Proto` header is `https`, `http` otherwise. It SHALL NOT forward any other client-supplied value.

#### Scenario: TLS terminator in front says https
- **WHEN** a request arrives with `X-Forwarded-Proto: https`
- **THEN** the backend receives `X-Forwarded-Proto: https`

#### Scenario: Arbitrary client value
- **WHEN** a request arrives with no `X-Forwarded-Proto`, or with any value other than `https`
- **THEN** the backend receives `X-Forwarded-Proto: http`

### Requirement: The frontend image installs with the repository's npm settings
The frontend image build SHALL install dependencies with the same npm configuration file CI uses, not with options restated on its own command line.

#### Scenario: npm setting added to the repository
- **WHEN** an option is added to the repository's npm configuration file
- **THEN** both CI's install and the frontend image build apply it
