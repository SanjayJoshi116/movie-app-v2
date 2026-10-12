## MODIFIED Requirements

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
