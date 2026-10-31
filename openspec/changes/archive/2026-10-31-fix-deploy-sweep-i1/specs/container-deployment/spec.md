## MODIFIED Requirements

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

## ADDED Requirements

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
