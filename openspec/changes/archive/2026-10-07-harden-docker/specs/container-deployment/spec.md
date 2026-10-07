## Purpose

Defines how the production Docker deployment is built and run: what the images
contain, which user the backend runs as, how the database schema is brought up
at boot, the security headers every response carries, and what the production
API renders, so the documented "production stack" is safe to expose.

## ADDED Requirements

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
- allows images only from the site's own origin, `data:` and TMDB's image host
- allows fonts and stylesheets from the site's own origin and the font provider the app uses
- allows framing only of the trailer embed host, and lets the site be framed only by itself
- forbids plugins (`object-src 'none'`)

Every page of the app SHALL work under this policy without violations.

#### Scenario: App pages load cleanly
- **WHEN** a user browses Movies, a movie detail page with a trailer, Stats and their profile with an avatar
- **THEN** posters, fonts, the trailer and the avatar all load, and the browser reports no CSP violations

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
