## ADDED Requirements

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
