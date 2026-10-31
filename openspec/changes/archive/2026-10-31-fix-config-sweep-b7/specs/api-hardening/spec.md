## MODIFIED Requirements

### Requirement: Production configuration fails closed
When the debug setting isn't explicitly enabled, the backend SHALL run with debug off. With debug off, the backend SHALL refuse to start if the allowed-hosts setting contains a wildcard or is empty, if the secret key is weak (under 50 characters, under 5 distinct characters, or starting with `django-insecure-`, which includes the built-in development default), if a separate JWT signing key is set and weak by the same rule, if the TMDB API key is unset or blank, if no email backend is configured explicitly, if the frontend URL (the base of password-reset links) is unset, blank, or not an absolute `http` or `https` URL with a host, or if the TMDB session encryption keys are unset, blank or not valid keys. A trailing slash on the frontend URL SHALL be ignored, so reset links never contain a double slash. A JWT signing key that is set but blank SHALL be treated as unset, so tokens are signed with the secret key, never with an empty key. Boolean settings (`DEBUG`, `EMAIL_USE_TLS`) SHALL accept `true`, `1`, `yes`, `on` and `false`, `0`, `no`, `off` in any letter case; any other value SHALL fail startup with a configuration error naming the variable, in every mode.

#### Scenario: DEBUG unset
- **WHEN** the backend starts with no `DEBUG` environment variable and valid production settings
- **THEN** it runs with debug off (no debug error pages, no permissive CORS/hosts relaxation)

#### Scenario: Wildcard hosts in production
- **WHEN** the backend starts with debug off and `ALLOWED_HOSTS=*`
- **THEN** startup fails with a configuration error naming `ALLOWED_HOSTS`

#### Scenario: No email backend in production
- **WHEN** the backend starts with debug off and no `EMAIL_BACKEND` environment variable
- **THEN** startup fails with a configuration error naming `EMAIL_BACKEND`, so password-reset links are never silently printed to the container log

#### Scenario: Console email chosen explicitly
- **WHEN** the backend starts with debug off and `EMAIL_BACKEND` set explicitly to the console backend
- **THEN** it starts

#### Scenario: No frontend URL in production
- **WHEN** the backend starts with debug off and `FRONTEND_URL` unset or blank
- **THEN** startup fails with a configuration error naming `FRONTEND_URL`, so reset emails never link to `localhost`

#### Scenario: Malformed frontend URL in production
- **WHEN** the backend starts with debug off and `FRONTEND_URL=cinedb.example.com` (no scheme) or `FRONTEND_URL=ftp://cinedb.example.com`
- **THEN** startup fails with a configuration error naming `FRONTEND_URL`

#### Scenario: Trailing slash on the frontend URL
- **WHEN** the backend runs with `FRONTEND_URL=https://cinedb.example.com/` and a user requests a password reset
- **THEN** the emailed link starts with `https://cinedb.example.com/reset-password/`

#### Scenario: No TMDB session keys in production
- **WHEN** the backend starts with debug off and `TMDB_SESSION_KEYS` unset, blank, or containing a value that isn't a valid key
- **THEN** startup fails with a configuration error naming `TMDB_SESSION_KEYS`, so sessions are never stored under a guessable key

#### Scenario: Weak secret key in production
- **WHEN** the backend starts with debug off and `SECRET_KEY` set to the example file's placeholder, to the built-in default, or to any value under 50 characters
- **THEN** startup fails with a configuration error naming `SECRET_KEY`

#### Scenario: Weak JWT signing key in production
- **WHEN** the backend starts with debug off, a strong `SECRET_KEY`, and `JWT_SIGNING_KEY=changeme`
- **THEN** startup fails with a configuration error naming `JWT_SIGNING_KEY`

#### Scenario: Blank JWT signing key
- **WHEN** the backend starts with `JWT_SIGNING_KEY` set to an empty value
- **THEN** tokens are signed with `SECRET_KEY`

#### Scenario: No TMDB API key in production
- **WHEN** the backend starts with debug off and `TMDB_API_KEY` unset or blank
- **THEN** startup fails with a configuration error naming `TMDB_API_KEY`, instead of booting healthy and failing every TMDB call

#### Scenario: Lower-case boolean
- **WHEN** the backend starts with `EMAIL_USE_TLS=true`
- **THEN** outgoing mail uses STARTTLS, as with `EMAIL_USE_TLS=True`

#### Scenario: Unrecognised boolean
- **WHEN** the backend starts with `EMAIL_USE_TLS=ture` or `DEBUG=maybe`
- **THEN** startup fails with a configuration error naming that variable

#### Scenario: Local development
- **WHEN** a developer runs `npm run dev`
- **THEN** the backend runs with debug on and accepts LAN-address hosts, as it does today, emails go to the console without any extra setting, and reset links point at `http://localhost:3000` unless `FRONTEND_URL` says otherwise, and TMDB sessions are encrypted with a development key without any extra setting

## ADDED Requirements

### Requirement: Local development keeps a rate-limit identity per device
When the backend is started for local development, it SHALL trust the one forwarding hop added by the development server's proxy, so each device reaching the app through that proxy has its own rate-limit allowance. The production default (no trusted proxy unless the deploy sets a count) SHALL stay unchanged.

#### Scenario: Two devices in local development
- **WHEN** a developer runs `npm run dev`, one LAN device exhausts the login rate limit through the development server, and a second device then signs in through it
- **THEN** the second device's sign-in is not rate-limited

#### Scenario: Explicit count in local development
- **WHEN** a developer sets `TRUSTED_PROXY_COUNT=0` in the environment and runs `npm run dev`
- **THEN** the backend uses 0

#### Scenario: Production default unchanged
- **WHEN** the backend starts outside the local development launcher with no `TRUSTED_PROXY_COUNT`
- **THEN** it trusts no forwarding header
