## MODIFIED Requirements

### Requirement: Production configuration fails closed
When the debug setting isn't explicitly enabled, the backend SHALL run with debug off. With debug off, the backend SHALL refuse to start if the allowed-hosts setting contains a wildcard or is empty, if the secret key is the built-in development default, if no email backend is configured explicitly, or if the frontend URL (the base of password-reset links) is unset, blank, or not an absolute `http` or `https` URL with a host. A trailing slash on the frontend URL SHALL be ignored, so reset links never contain a double slash.

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

#### Scenario: Local development
- **WHEN** a developer runs `npm run dev`
- **THEN** the backend runs with debug on and accepts LAN-address hosts, as it does today, emails go to the console without any extra setting, and reset links point at `http://localhost:3000` unless `FRONTEND_URL` says otherwise

## ADDED Requirements

### Requirement: The backend exposes no admin interface
The backend SHALL NOT serve a built-in administration site or any other server-rendered login form, in development or production. Accounts are managed only through the API and management commands.

#### Scenario: Admin path in development
- **WHEN** a client requests `/admin/` or `/admin/login/` from the dev backend
- **THEN** the response is a 404 and no login form is rendered

#### Scenario: Management commands still work
- **WHEN** an operator runs `manage.py createsuperuser` or `manage.py changepassword`
- **THEN** the command works as before
