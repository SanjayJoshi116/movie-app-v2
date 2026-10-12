## Purpose

Keeps page loads fast by bounding how many requests a page makes and how many bytes it pulls. Covers how the development build reaches the API, detail-page and library-load request counts, sharing of duplicate requests, image sizes and when trailers load.

## ADDED Requirements

### Requirement: Development API traffic is same-origin
In the development setup, the app SHALL reach the backend API and user media through its own origin (the dev server forwards them to the backend over IPv4 loopback). So API calls SHALL need no cross-origin preflight, and SHALL NOT depend on how `localhost` resolves on the developer's machine. Production SHALL keep reaching the API through its configured base URL.

#### Scenario: Browsing in development
- **WHEN** a signed-in user opens any page under `npm start`
- **THEN** every API and TMDB call goes to the page's own origin, and the browser sends no `OPTIONS` preflight for them

#### Scenario: `localhost` resolves to IPv6 first
- **WHEN** the developer's machine resolves `localhost` to `::1` before `127.0.0.1` and the backend listens on IPv4 only
- **THEN** API calls still connect without an IPv6 fallback delay

#### Scenario: Another device on the LAN
- **WHEN** a phone on the same network opens the dev app by the machine's LAN address
- **THEN** pages load and API calls succeed through that same address

### Requirement: A detail page loads its data in one TMDB request
Opening a movie or TV detail page SHALL fetch the title's details and all of its secondary sections (credits, images, videos, recommendations, similar titles, reviews, watch providers, and release dates or content ratings) in a single TMDB request.

#### Scenario: Open a movie
- **WHEN** a user opens `/movie/550`
- **THEN** exactly one TMDB proxy request is made for that page's data

#### Scenario: Open a TV show
- **WHEN** a user opens a TV detail page
- **THEN** exactly one TMDB proxy request is made for the show's data (opening a season's episode guide may make its own request)

### Requirement: Identical in-flight TMDB requests are shared
When the app asks for a TMDB resource while an identical request (same path and parameters) is still in flight, it SHALL reuse that request's result instead of sending another. This SHALL hold in the development build, which mounts components twice.

#### Scenario: Development double mount
- **WHEN** a detail page or the home hero banner mounts under `npm start`
- **THEN** each distinct TMDB request is sent once

#### Scenario: Request after the first finished
- **WHEN** the same resource is requested again after the first request has settled
- **THEN** a new request is sent, since sharing covers only requests in flight

### Requirement: Library loads use few requests
Loading the signed-in user's watched history, watchlist or ratings SHALL fetch at most 500 entries per request, and SHALL use no more requests than `ceil(entries / 500)` (at least one). The API SHALL accept a client-chosen page size up to 500 on these lists, and SHALL keep its default page size when none is given.

#### Scenario: Large watched history
- **WHEN** a user with 1,300 watched titles loads the app
- **THEN** the watched history arrives in 3 requests, and every entry is present exactly once

#### Scenario: Oversized page request
- **WHEN** a client asks for a page size above 500
- **THEN** the API returns at most 500 entries per page

### Requirement: Images are requested at the size they're shown
Poster thumbnails in card grids SHALL be requested at a width of about 342 px. Hero and detail-page backdrops SHALL be requested at a width of about 1280 px. The original-resolution image SHALL be requested only when the user opens the full-screen image preview. The backdrop at the top of the home, anime and detail pages SHALL NOT be deferred as lazy-loaded.

#### Scenario: Browse grid
- **WHEN** a user opens the Movies grid
- **THEN** poster images are requested at the `w342` size, not `w500` or `original`

#### Scenario: Detail backdrop and gallery
- **WHEN** a user opens a detail page and then opens an image from its gallery in the preview
- **THEN** the page backdrop is requested at `w1280`, and only the previewed image is requested at `original`

### Requirement: Trailers load only on request
Detail pages SHALL show each trailer as a thumbnail with a play control, and SHALL load the video player only after the user activates that control. Activating it SHALL start the trailer. The control SHALL be operable from the keyboard and SHALL carry an accessible name that includes the trailer's title.

#### Scenario: Open a page with trailers
- **WHEN** a user opens a detail page with two trailers and doesn't play them
- **THEN** no video player frame is loaded

#### Scenario: Play a trailer
- **WHEN** the user activates a trailer's play control by mouse or keyboard
- **THEN** that trailer's player loads in place and starts playing
