# CINE DB

A personal movie and TV show discovery and tracking app powered by the [TMDB API](https://www.themoviedb.org/documentation/api), with a Django + PostgreSQL backend for user accounts and persistent data.

[![CI](https://github.com/SanjayJoshi116/movie-app-v2/actions/workflows/ci.yml/badge.svg)](https://github.com/SanjayJoshi116/movie-app-v2/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Demo

No live deployment yet — see [Quick Start](#quick-start) to run locally.

---

## Screenshots

| Home | Movie Detail | Stats Dashboard | Release Calendar |
|------|-------------|-----------------|-----------------|
| *Coming soon* | *Coming soon* | *Coming soon* | *Coming soon* |

---

## Features

### Discovery
- **Browse & Search** — Discover, Now Playing, Top Rated, Upcoming, and Popular categories for movies, TV shows, and anime; dedicated Search page with live results across movies, TV, and people
- **Hero Banner** — Trending title of the week as a full-width backdrop with title, overview, rating, and direct link
- **Recent Searches** — Search history dropdown (last 5 queries)
- **Advanced Filters** — Filter by year range, TMDB rating, language, runtime, and sort order; year and release-date sort correctly use `first_air_date` for TV and `primary_release_date` for movies
- **Genre Tags** — Click any genre to filter results
- **Infinite Scroll** — Home, TV, and Anime pages load more as you scroll
- **Recently Watched Strip** — Quick-access thumbnails at the top of Movies and TV pages, filtered by media type

### Detail Pages
- **Movie & TV Detail** — Full info: cast, videos, images, reviews, recommendations, similar titles, watch providers, streaming availability; backdrop hero with horizontal cast scroll
- **Add to List** — Add or remove a title from any custom list directly from the detail page
- **Episode Guide** — Season/episode breakdown on TV detail pages
- **Episode Progress Tracker** — Track your current season and episode per show, with +/- controls bounded by the show's actual season and episode counts; edit or delete progress at any time
- **Person Pages** — Actor/crew bios with full filmography tabs (all credits, movies, TV, photos)
- **Follow Actors & Directors** — Follow any person from their detail page; manage followed people at `/following`

### Library
- **Watchlist & Watched** — Save and track movies/TV shows; tied to your account
- **Search, Sort & Export** — Both Watchlist and Watched pages support title search, multiple sort options (newest, title, rating), and one-click CSV export
- **Ratings & Reviews** — Rate anything 1–10 and write personal notes
- **User Lists** — Create named lists, add or remove any movie or show, and export each list as CSV
- **CSV Import** — Bulk-import a watched history from any CSV with a TMDB ID column; watched list refreshes immediately after import
- **Stats Dashboard** — Visual overview of your watch history at `/stats`: total counts, movie vs TV split (pie chart), personal rating distribution (bar chart), monthly activity (bar chart), and top genres (horizontal bar chart)
- **Recommendations** — Personalized suggestions based on your watch history, plus "Because you watched X" sections and recommendations from people you follow (`/recommendations`); results are pre-computed at backend startup and served instantly from DB cache. On a cold cache (first-ever request, large watch history) the page polls the API every few seconds and shows a "crunching your watch history" state until results land
- **Release Calendar** — 60-day lookahead of upcoming releases, grouped by date, fetching up to 3 pages per type; one-click iCal export (`.ics`) for Google Calendar / Apple Calendar (`/calendar`)

### Auth
- **Login / Register** — JWT-based auth; tokens stored in `localStorage`
- **Password Reset** — Email-based: enter your account email, receive a reset link, set a new password via the link

### UI & UX
- **Skeleton Loaders** — Content placeholders while data loads
- **Toast Notifications** — Feedback on watchlist, watched, list, follow, and rating actions
- **Dark / Light Mode** — Cinema-dark (`#0d0f1a`) and light themes; preference saved per account
- **Info Tooltips** — `(i)` tooltips next to non-obvious labels/stats (Stats, Calendar, Lists, Watched, Recommendations, Movie/TV Detail)
- **Unified Typography Scale** — Poppins font throughout; a small `FONT_SIZE` scale (caption/body/emphasis/display) replaces ad-hoc inline sizes
- **Consistent Date Format** — All dates render `dd-mm-yyyy`, independent of the viewer's browser/OS locale
- **Animated UI** — Page transitions and card hover effects via Framer Motion
- **Responsive Layout** — Persistent sidebar on desktop; fixed bottom nav with overflow drawer on mobile

---

## Tech Stack

**Frontend**
- [React 18](https://react.dev/) + [Create React App](https://create-react-app.dev/)
- [TypeScript 5](https://www.typescriptlang.org/) — strict mode
- [React Router v6](https://reactrouter.com/)
- [Ant Design 5](https://ant.design/) + [@ant-design/icons](https://ant.design/components/icon/)
- [Framer Motion](https://www.framer.com/motion/)
- [Recharts](https://recharts.org/) — stats dashboard charts
- [Axios](https://axios-http.com/)
- [Express.js](https://expressjs.com/) — TMDB API proxy

**Backend**
- [Django 4](https://www.djangoproject.com/) + [Django REST Framework](https://www.django-rest-framework.org/)
- [djangorestframework-simplejwt](https://django-rest-framework-simplejwt.readthedocs.io/) — JWT auth
- [scikit-learn](https://scikit-learn.org/) — K-means clustering for recommendations
- [PostgreSQL](https://www.postgresql.org/) + [psycopg2](https://www.psycopg.org/)
- [Ruff](https://docs.astral.sh/ruff/) — Python lint/format, config in `pyproject.toml`

**APIs**
- [TMDB API](https://developer.themoviedb.org/)

---

## Architecture Overview

```
backend/
├── cinedb/
│   ├── settings.py              # Django settings (PostgreSQL, JWT, CORS, email, throttle rates)
│   └── urls.py                  # Root URL config — mounts /api/
├── userdata/
│   ├── models.py                # WatchlistEntry, WatchedEntry, RatingEntry,
│   │                            #   UserList, UserListItem, EpisodeProgress, FollowedPerson,
│   │                            #   UserRecommendationCache (pre-computed rec cache per user)
│   ├── serializers.py           # DRF serializers (camelCase field aliases)
│   ├── pagination.py            # DefaultPagination (PageNumberPagination, page_size=100)
│   │                            #   applied to watchlist/watched/ratings/followed-people lists
│   ├── views.py                 # Thin re-export barrel — import from domain modules below
│   ├── auth_views.py            # register, login, profile, password reset + throttle classes
│   ├── watchlist_views.py       # watchlist CRUD (paginated list)
│   ├── watched_views.py         # watched CRUD (paginated list) + bulk import
│   ├── ratings_views.py         # ratings CRUD (paginated list) + TMDB mirror
│   ├── lists_views.py           # user lists + list items CRUD
│   ├── tmdb_views.py            # TMDB OAuth (request token, session, disconnect)
│   ├── stats_views.py           # stats aggregation + genre cache
│   ├── social_views.py          # episode progress + followed people (paginated list) + recs
│   ├── urls.py                  # /api/ endpoint routing
│   ├── recommendations.py       # K-means genre clustering + followed-people recommendations;
│   │                            #   _compute_for_you / _compute_personalized are standalone fns
│   │                            #   called by views (cache hit) and management command (pre-compute)
│   ├── management/
│   │   └── commands/
│   │       └── compute_recommendations.py  # Management command: pre-computes rec cache for all users;
│   │                                       #   run at container startup via docker-entrypoint.sh
│   ├── tmdb_client.py           # Server-side TMDB API client
│   └── tests/                   # pytest suite: auth, delete-account, password reset,
│                                #   watchlist/watched/ratings pagination, bulk_watched
├── docker-entrypoint.sh         # Prod container entrypoint: migrate --run-syncdb → gunicorn
└── manage.py

src/
├── api/
│   ├── tmdb.ts                  # TMDB API calls — typed, proxied through Express;
│   │                            #   filtersToTMDBParams() accepts mediaType to correctly
│   │                            #   map year/sort params for movies vs TV
│   └── userApi.ts               # Axios instance with Bearer token + auto 401 refresh;
│                                #   exports fetchStats, episode-progress helpers,
│                                #   followed-people helpers, requestPasswordReset,
│                                #   confirmPasswordReset, bulkMarkWatched
├── components/
│   ├── layout/
│   │   └── FilterPanel.tsx      # Advanced filter UI (Ant Design Drawer, right-side)
│   ├── ui/
│   │   └── StarRating.tsx       # Ant Design Rate (1–10, gold, keyboard accessible)
│   ├── watchlist/
│   │   ├── RatingModal.tsx      # Modal + Form for rating + review
│   │   └── WatchlistStats.tsx   # Summary stats for the watchlist page
│   ├── ErrorBoundary.tsx
│   ├── Sidebar.tsx              # Desktop: 220px left nav — shows username/sign-out when authed
│   ├── BottomNav.tsx            # Mobile: fixed bottom nav + overflow drawer
│   ├── SearchBox.tsx            # Input.Search with recent-search history dropdown
│   ├── HeroBanner.tsx           # Trending title hero with backdrop and CTA
│   ├── SkeletonCard.tsx         # Skeleton placeholder for media cards
│   ├── StreamingBadges.tsx      # JustWatch provider logos
│   ├── EpisodeGuide.tsx         # Season/episode list for TV detail pages
│   ├── CSVUploadModal.tsx       # CSV import modal with preview + TMDB poster enrichment
│   ├── ProfileModal.tsx         # Edit profile + change password + delete account (password-confirmed) + TMDB OAuth connect
│   ├── Movie.tsx / Movies.tsx
│   ├── TVShows.tsx / TVShowCard.tsx  # TVShows maps a memoized per-item TVShowCard (mirrors Movie.tsx)
│   ├── MovieDetails.tsx         # Includes add-to-list with checkbox toggle (add + remove)
│   ├── TVShowDetails.tsx        # Includes episode progress tracker; add-to-list with toggle
│   ├── Overlay.tsx              # Video trailer overlay
│   └── Tags.tsx
├── context/
│   ├── AppContext.tsx            # Composes UIContext + WatchlistContext + WatchedContext + RatingsContext
│   ├── UIContext.tsx             # theme, search, genre filters
│   ├── WatchlistContext.tsx      # Wraps useWatchlist()
│   ├── WatchedContext.tsx        # Wraps useWatched()
│   ├── RatingsContext.tsx        # Wraps useRatings()
│   ├── AuthContext.tsx           # login, register, logout — persists user in localStorage
│   ├── ListsContext.tsx          # User lists state
│   ├── useAppContext.ts          # Back-compat shim merging the 4 split contexts into the original shape
│   └── useListsContext.ts
├── hooks/
│   ├── useWatchlist.ts          # Async CRUD → /api/watchlist/ (walks pagination via fetchAllPages)
│   ├── useWatched.ts            # Async CRUD → /api/watched/; includes reload() for bulk-import sync
│   ├── useRatings.ts            # Async CRUD → /api/ratings/
│   ├── useLists.ts              # Async CRUD → /api/lists/ (items carry _itemId for DELETE)
│   ├── useEpisodeProgress.ts    # Fetch/update/delete episode progress → /api/episode-progress/
│   ├── useFollowedPeople.ts     # Follow/unfollow actors & directors → /api/followed-people/
│   ├── useInfiniteScroll.ts     # IntersectionObserver for infinite scroll + scroll restoration
│   ├── usePaginatedFetch.ts     # Shared fetch-page-1/loadMore/restore-on-back-nav logic for
│   │                            #   Home/Anime/People pages
│   ├── useToast.ts              # App.useApp() toast wrapper
│   ├── useLocalStorage.ts       # Generic localStorage hook
│   └── useRecentSearches.ts     # Last 5 searches
├── pages/
│   ├── HomePage.tsx             # /movies and /tv — HeroBanner, recently watched strip, infinite scroll
│   ├── SearchPage.tsx           # /search — live results across movies, TV, and people
│   ├── AnimePage.tsx            # /anime — filtered TV browse (keyword 210024)
│   ├── MovieDetailPage.tsx      # /movie/:id
│   ├── TVDetailPage.tsx         # /tv/:id
│   ├── PersonPage.tsx           # /person/:id — bio, filmography, follow button
│   ├── PeoplePage.tsx           # /people — popular people browse with infinite scroll
│   ├── WatchlistPage.tsx        # /watchlist — search, sort, export CSV (protected)
│   ├── WatchedPage.tsx          # /watched — search, sort, export CSV (protected)
│   ├── ListsPage.tsx            # /lists — create/delete lists, add items, export CSV (protected)
│   ├── StatsPage.tsx            # /stats — watch history charts (protected)
│   ├── FollowingPage.tsx        # /following — manage followed people (protected)
│   ├── CalendarPage.tsx         # /calendar — 60-day release lookahead + iCal export (protected)
│   ├── RecommendationsPage.tsx  # /recommendations — personalized + followed-people recs (protected)
│   ├── LoginPage.tsx            # /login
│   ├── RegisterPage.tsx         # /register
│   ├── ForgotPasswordPage.tsx   # /forgot-password — email-based reset link request
│   ├── ResetPasswordPage.tsx    # /reset-password/:uid/:token — set new password from link
│   └── TMDBCallbackPage.tsx     # /tmdb-callback — completes TMDB OAuth session exchange
├── utils/
│   ├── export.ts                # downloadCSV / downloadJSON helpers (Blob + URL.createObjectURL)
│   ├── apiError.ts              # getApiError(error) — normalizes axios/DRF errors to a string
│   └── fetchAllPages.ts         # Walks a DRF-paginated endpoint's pages and concatenates results
│                                #   (falls back to a plain array response transparently)
├── constants/
│   ├── ui.ts                    # pageVariants (Framer Motion), IMG_URL, NO_IMAGE — shared across pages
│   └── genres.ts                # Static TMDB genre list for filter UI
├── theme/
│   └── antdTheme.ts             # Ant Design ConfigProvider tokens: dark / light
└── types/
    ├── domain.ts                # MediaType, WatchlistEntry, RatingEntry, UserList…
    ├── tmdb.ts                  # All TMDB API response shapes
    ├── context.ts               # AppContextType, ListsContextType
    └── index.ts                 # Barrel re-export
```

**Key design decisions:**

- **Auth** — JWT via `djangorestframework-simplejwt`. Access (60 min) + refresh (7 days) tokens stored in `localStorage`. `userApi.ts` intercepts 401s and silently refreshes before retrying failed requests. Password reset uses Django's built-in token generator sent via email; the link encodes a base64 uid and a one-use HMAC token.
- **Password strength** — Registration, profile password change, and password-reset confirmation all run Django's configured `AUTH_PASSWORD_VALIDATORS` (`validate_password()`) — minimum length 8, rejects common passwords, rejects passwords too similar to the username/email, rejects all-numeric passwords.
- **Account deletion** — `DELETE /api/auth/delete-account/` requires the user's current password in the request body and re-verifies it with `check_password()` before deleting; the frontend's Danger Zone in `ProfileModal` collects it inline.
- **List pagination** — `/api/watchlist/`, `/api/watched/`, `/api/ratings/`, and `/api/followed-people/` are paginated (`DefaultPagination`, page_size=100) and return `{count, next, previous, results}`. `src/utils/fetchAllPages.ts` transparently walks all pages so the frontend hooks (`useWatchlist`, `useWatched`, `useRatings`, `useFollowedPeople`) still expose the full list — it also accepts a plain array response for back-compat with mocked tests.
- **Rate limiting** — DRF `AnonRateThrottle` subclasses applied to public auth endpoints: login (10/min), register (5/min), password reset (5/hour). Rates configured in `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]` in `settings.py`; no extra package needed.
- **Production config** — `DEBUG`, `ALLOWED_HOSTS`, and `SECRET_KEY` are all env-controlled in `backend/cinedb/settings.py`. `ALLOWED_HOSTS` fails closed (empty by default) rather than defaulting to `*`. When `DEBUG=False`, an unset `SECRET_KEY` raises `ImproperlyConfigured` at startup instead of a silent fallback. `CORS_ALLOW_ALL_ORIGINS` is only enabled in `DEBUG`; production reads explicit origins from `CORS_ALLOWED_ORIGINS`.
- **Backend view split** — `views.py` was a 750-line monolith; now a thin re-export barrel. Domain logic lives in `auth_views.py`, `watchlist_views.py`, `watched_views.py`, `ratings_views.py`, `lists_views.py`, `tmdb_views.py`, `stats_views.py`, `social_views.py`. `urls.py` is unchanged.
- **Bulk watched import** — `POST /api/watched/bulk/` validates a batch cap (500 entries), dedupes repeated `mediaId`s within the same payload, and writes via `bulk_create(ignore_conflicts=True)` inside `transaction.atomic()` instead of one `get_or_create()` per row.
- **Production server** — The backend container runs `docker-entrypoint.sh` (`migrate --run-syncdb` → `gunicorn cinedb.wsgi:application`) instead of Django's dev server. `makemigrations` is no longer run automatically at container boot — generate new migrations explicitly with `python backend/manage.py makemigrations userdata` during development, same as any other Django project. `backend/start.py` (used by `npm run dev` for local non-Docker dev) keeps the DB-create-if-missing + `migrate` + `runserver` flow, minus `makemigrations`.
- **DB indexes** — Migration `0008_add_indexes.py` adds compound indexes on `(user, *_at)` fields across WatchedEntry, WatchlistEntry, RatingEntry, FollowedPerson, EpisodeProgress, and `(user, release_year)` for stats decade queries.
- **Split contexts** — `AppContext` used to be one context bundling search/filters/theme with watchlist/watched/ratings, so any UI-state change (typing in search, toggling a genre) re-rendered every consumer, including movie/TV cards. It's now `UIContext` + `WatchlistContext` + `WatchedContext` + `RatingsContext`, each independently memoized; `useAppContext()` is kept as a back-compat shim so existing call sites are unchanged. `Movie`, `TVShowCard`, `RecCard`, and `CreditCard` are wrapped in `React.memo` and read only the specific contexts they need.
- **Stable hook callbacks** — `useWatchlist`, `useRatings`, and `useWatched` use `useCallback` with a ref pattern (`watchlistRef.current = watchlist`) so returned functions only change identity when `isAuthenticated` changes, not on every render. This keeps the split contexts' `useMemo` from recomputing on unrelated parent re-renders.
- **API key security** — The TMDB key lives in `.env` and is only accessed server-side (Express proxy or Django). Frontend requests go through `/api/tmdb/*`.
- **Backend data** — All user data lives in PostgreSQL, bound to the authenticated user. No localStorage drift.
- **Recommendations** — K-means clustering on rating-weighted genre vectors of the user's watch history (scikit-learn). Followed-people recommendations are fetched in parallel with personal recommendations and shown at the top. Only fetched once on first load (guarded by a `useRef` flag). Results are pre-computed and stored in `UserRecommendationCache` (PostgreSQL) at backend startup via the `compute_recommendations` management command; endpoints serve from DB in ~1ms. Stale cache (>12 h) triggers a background thread refresh on the next request. The `for-you`/`personalized` endpoints report `{status: "pending" | "ready", sections}` — an in-process set tracks which users have a refresh in flight so concurrent requests don't spawn duplicate threads. While `pending`, `RecommendationsPage` polls every 3s (up to ~1 min) instead of showing a terminal empty state.
- **Filter params by media type** — `filtersToTMDBParams(filters, sortBy, mediaType)` uses `first_air_date` for TV and `primary_release_date` for movies, and remaps `primary_release_date.*` sort options to `first_air_date.*` for TV discover queries.
- **Episode progress bounds** — The tracker reads `number_of_seasons` and `seasons[].episode_count` from the TMDB TV detail response to cap the +/- controls; no extra API call needed.
- **CSV import** — Parses CSV in the browser (handles quoted fields and `""` escaped quotes), enriches with TMDB poster data in batches of 20, bulk-saves via `/api/watched/bulk/`, then calls `reloadWatched()` so the watched list in context updates immediately.
- **CSV export** — Pure browser-side: `Blob` + `URL.createObjectURL`. No server round-trip.
- **Image lazy loading** — All off-screen/below-fold `<img>` tags carry `loading="lazy"`. Hero backdrop and main detail-page poster intentionally omitted (LCP images; eager is correct).
- **Security headers** — `nginx.conf` sets `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy`, and `Permissions-Policy` on every response.
- **Protected routes** — Unauthenticated access to any non-public path redirects to `/login` with `state.from` preserved, handled inline in `AppInner` (`App.tsx`). Public paths: `/login`, `/register`, `/forgot-password`, `/reset-password/*`.
- **Layout** — `App.tsx` uses a plain flex `div.app-shell`: `<Sidebar>` (desktop) + `<main>` + `<BottomNav>` (mobile). No Ant Design Layout wrapper.
- **State** — `AppContext` for global UI state; `AuthContext` for auth; `ListsContext` for lists. Ephemeral page state (loading, pagination) stays local to each page component.
- **Scroll restoration** — HomePage, AnimePage, and PeoplePage encode `scrollY` and `loadedPages` in `navigate()` state when clicking into a detail or person page; the shared `usePaginatedFetch` hook (`src/hooks/usePaginatedFetch.ts`) handles fetch-page-1/loadMore/restore-on-return for all three, replacing what used to be ~90% duplicated per-page logic. On back-navigation it re-fetches the required pages in parallel and restores scroll position via `useLayoutEffect`. `SearchPage`'s tab-based search (`usePaginatedSearch`) has different restore mechanics (per-tab `sessionStorage` cache keyed by query, since its tabs mount/unmount independently) and is intentionally not merged into the shared hook. WatchlistPage persists scroll position, search query, and sort key in `sessionStorage`; ListsPage persists the selected list id — both survive full navigation away and back.
- **API error normalization** — `src/utils/apiError.ts` exports `getApiError(error)` which extracts a human-readable string from axios errors, handling DRF's `detail`, `non_field_errors`, and field-level error shapes. Used consistently across catch blocks (rating save, CSV import, list/watched actions) so failures surface a real message instead of a generic or silently-swallowed one.
- **Ratings** — Validated 0.5–10 on both `RatingEntry.user_rating` (model `MinValueValidator`/`MaxValueValidator`) and the serializer field, matching TMDB's own rating scale.
- **CI/CD** — `.github/workflows/ci.yml` runs three jobs on every push/PR to main: frontend (Jest + build), backend (`ruff check` + pytest against a live Postgres service container), and `e2e-python` (pytest-playwright against the React dev server, fully network-mocked).
- **Routing** — React Router v6. Every movie, show, and person has its own URL.
- **TypeScript** — Strict mode. All TMDB response shapes typed in `src/types/tmdb.ts`.
- **UI** — Ant Design 5 with `ConfigProvider`. Cinema-dark uses `#0d0f1a` background and `#f5c518` gold accent. Cards use `rgba` glassmorphism (`.glass-card`, `.glass-sidebar`).
- **Error boundaries** — Root, per-route, and video overlay placements.
- **Typography** — `src/constants/typography.ts` exports `FONT_SIZE.caption/body/emphasis/display`; every inline `fontSize` in the app sources from this scale instead of a hardcoded number (icon-scaling `fontSize` props on antd icons are the one exception). Heading sizes are set once via antd theme tokens in `src/theme/antdTheme.ts`.
- **Date formatting** — `src/utils/formatDate.ts` (`formatDateDMY`) renders dates as `dd-mm-yyyy` regardless of the viewer's locale, used anywhere a date is shown to the user (Watched, Lists, Movie/TV Detail).
- **Info tooltips** — `src/components/InfoTooltip.tsx` wraps antd `Tooltip` + `InfoCircleOutlined` into one reusable `<InfoTooltip title="..." />`.

---

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+ (Anaconda recommended)
- PostgreSQL
- A free [TMDB API key](https://developer.themoviedb.org/docs/getting-started)

### Installation

1. Install frontend dependencies:

```bash
npm install
```

2. Install backend dependencies:

```bash
pip install -r backend/requirements.txt
```

3. Set up environment variables — see [Environment Variables](#environment-variables) below.

4. Run Django migrations:

```bash
python backend/manage.py migrate
```

5. (Optional) Pre-compute recommendation cache:

```bash
python backend/manage.py compute_recommendations
```

> This runs automatically at backend startup. Run manually to warm the cache before first use.

6. Start all three servers:

```bash
npm run dev
```

The React app runs at `http://localhost:3000`. The Express proxy runs at `http://localhost:3001`. The Django API runs at `http://localhost:8000`.

> **Note:** All three must be running for the app to work fully. `npm run dev` starts them together using `concurrently`.

### Available Scripts

| Command                     | Description                                           |
| --------------------------- | ----------------------------------------------------- |
| `npm run dev`               | Start React, Express proxy, and Django (recommended)  |
| `npm start`                 | Start React dev server only                           |
| `npm run server`            | Start Express proxy server only                       |
| `npm run django`            | Start Django API server only                          |
| `npm run build`             | Production build                                      |
| `npm test`                  | Run Jest unit tests                                   |
| `npx playwright test`       | Run E2E tests (starts React dev server automatically) |
| `npx prettier --check src/` | Check formatting (config in `.prettierrc`)            |
| `npx prettier --write src/` | Auto-format all source files                          |
| `ruff check backend/`       | Lint Python backend (config in `pyproject.toml`)      |
| `pytest backend/`           | Run Django backend unit tests (needs `backend/requirements-test.txt`) |

---

## Environment Variables

### `.env` — Frontend + Express Proxy (project root)

```
TMDB_API_KEY=your_tmdb_api_key_here
```

### `backend/.env` — Django

```
SECRET_KEY=your-django-secret-key
DB_NAME=cinedb
DB_USER=postgres
DB_PASSWORD=your_db_password
DB_HOST=localhost
DB_PORT=5432

# Email password reset (leave blank to use console backend for development)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=you@gmail.com
EMAIL_HOST_PASSWORD=your_app_password
DEFAULT_FROM_EMAIL=noreply@cinedb.app

# Must match the port the React app runs on (3000)
FRONTEND_URL=http://localhost:3000

# Production overrides (required when DEBUG=False)
# DEBUG=False
# ALLOWED_HOSTS=yourdomain.com
```

---

## Docker Setup

All four services (frontend, proxy, backend, database) run together via Docker Compose.

1. Create `.env.docker` in the project root:

```
POSTGRES_PASSWORD=your_db_password
DB_PASSWORD=your_db_password
DB_NAME=cinedb
DB_USER=postgres
DB_HOST=db
DB_PORT=5432
TMDB_API_KEY=your_tmdb_api_key
SECRET_KEY=your-long-random-django-secret-key
JWT_SIGNING_KEY=your-long-random-jwt-signing-key
DJANGO_API_URL=http://backend:8000/api
DEBUG=False
ALLOWED_HOSTS=*
FRONTEND_URL=http://localhost
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=you@gmail.com
EMAIL_HOST_PASSWORD=your_app_password
DEFAULT_FROM_EMAIL=CINE DB <you@gmail.com>

# Optional: set to your machine's LAN IP so the proxy startup log shows the correct network URL
# HOST_IP=192.168.x.x
```

2. Build and start all services:

```bash
docker compose up --build
```

The app will be available at `http://localhost`.

### LAN Access (same network, different device)

When running via **Docker Desktop** on Windows or Mac, Docker properly forwards ports to the host machine's network interface. Other devices on the same network can access the app using the host machine's LAN IP:

```
http://<host-lan-ip>        # port 80
http://<host-lan-ip>:3000   # port 3000
```

Find the host LAN IP:
- **Windows:** `ipconfig` → look for **IPv4 Address** under Wi-Fi or Ethernet (e.g. `192.168.0.110`)
- **Mac/Linux:** `ifconfig` or `ip addr` → look for `inet 192.168.x.x`

> **Note:** `ALLOWED_HOSTS=*` in `.env.docker` is required for LAN access so Django accepts requests from any IP. This is safe for local network use. For public deployments, restrict to specific domains.

**Service layout:**

| Service    | Image                  | Port            |
| ---------- | ---------------------- | --------------- |
| `frontend` | nginx + React build    | 80 (public)     |
| `proxy`    | Node/Express           | 3001 (internal) |
| `backend`  | Python/Django          | 8000 (internal) |
| `db`       | postgres:15-alpine     | 5432 (internal) |

Nginx proxies `/api/*` to the Express proxy, which forwards TMDB requests and Django API calls. PostgreSQL data persists in the `pgdata` Docker volume.

---

## Testing

### Unit tests — Jest (29 tests, 4 suites)

Covers core hook and context logic. All hooks are tested with mocked `AuthContext` and `userApi` — no backend required.

```
src/hooks/__tests__/
├── useLocalStorage.test.ts
├── useWatchlist.test.ts
└── useRatings.test.ts

src/context/__tests__/
└── AppContext.test.tsx
```

```bash
npm test
```

### Unit tests — pytest (Django, 18 tests)

Covers register/password-validation, delete-account (password re-confirmation), password-reset-confirm validation, and pagination + `bulk_watched` behavior. Runs against a real Postgres DB (test DB is created/torn down automatically).

```
backend/userdata/tests/
├── test_auth.py       # Register password strength, delete-account confirmation, reset-confirm
├── test_watchlist.py  # Pagination shape + cross-user isolation
├── test_watched.py    # Pagination shape + bulk_watched (dedup, batch cap, transaction)
└── test_ratings.py    # Pagination shape
```

```bash
pip install -r backend/requirements-test.txt
pytest backend/
```

### E2E tests — Playwright (20 tests)

Covers auth flows, movie browsing, search, and watchlist operations. All API calls are mocked via Playwright route interception — no backend required. The React dev server starts automatically.

```
e2e/
├── auth.spec.ts       # Login, register, forgot password, redirect guards
├── movies.spec.ts     # Movie/TV browse, category buttons, search, detail navigation
└── watchlist.spec.ts  # Empty state, add/remove, export CSV, watched list
```

```bash
npx playwright test
```

### E2E tests — pytest-playwright (156 tests)

Broader-coverage E2E suite in Python, one file per feature area. Same approach as the TS suite — `page.route()` mocks every network call, so only the React dev server (`http://localhost:3000`) needs to be running.

```
e2e/python/
├── conftest.py        # Shared fixtures + mock data (users, tokens, movies, TV shows)
├── test_auth.py       # Login, register, password reset, redirect guards (29)
├── test_browse.py     # Movie/TV browse, categories, filters (13)
├── test_detail.py     # Movie/TV detail pages, cast, recommendations (16)
├── test_lists.py      # User lists CRUD + CSV export (16)
├── test_profile.py    # Profile edit, password change, TMDB connect (11)
├── test_ratings.py    # Rate + review flow (11)
├── test_search.py     # Live search across movies/TV/people (7)
├── test_stats.py      # Stats dashboard charts (18)
├── test_watched.py    # Watched list CRUD, CSV import/export (16)
└── test_watchlist.py  # Watchlist CRUD, sort, export (19)
```

```bash
cd e2e/python
pytest
```

> Requires `pip install -r e2e/python/requirements.txt` and `playwright install --with-deps chromium`.

### CI

GitHub Actions runs the Jest suite, Django `pytest` suite, `ruff check`, and the pytest-playwright E2E suite (`e2e/python/`) automatically on every push and pull request to `main` — see `.github/workflows/ci.yml`. The TypeScript Playwright suite (`e2e/*.spec.ts`) is not yet wired into CI; run it locally with `npx playwright test`.

---

## API Overview

| Method          | Endpoint                                    | Description                                        |
| --------------- | ------------------------------------------- | -------------------------------------------------- |
| POST            | `/api/auth/register/`                       | Create account                                     |
| POST            | `/api/auth/login/`                          | Login (returns access + refresh tokens)            |
| POST            | `/api/auth/token/refresh/`                  | Refresh access token                               |
| GET/PATCH       | `/api/auth/profile/`                        | Get or update profile (requires auth)              |
| DELETE          | `/api/auth/delete-account/`                 | Permanently delete account and all data            |
| POST            | `/api/auth/password-reset/`                 | Request email password reset link                  |
| POST            | `/api/auth/password-reset/confirm/`         | Confirm reset with uid + token + new password      |
| GET/POST        | `/api/watchlist/`                           | List or add watchlist entries                      |
| DELETE/PATCH    | `/api/watchlist/<id>/`                      | Remove or update a watchlist entry                 |
| DELETE          | `/api/watchlist/clear/`                     | Remove all watchlist entries                       |
| GET/POST        | `/api/watched/`                             | List or add watched entries                        |
| DELETE          | `/api/watched/<id>/`                        | Remove a watched entry                             |
| DELETE          | `/api/watched/clear/`                       | Remove all watched entries                         |
| POST            | `/api/watched/bulk/`                        | Bulk-import watched entries (CSV upload)           |
| GET/POST        | `/api/ratings/`                             | List or add/update ratings                         |
| DELETE/PATCH    | `/api/ratings/<id>/`                        | Remove or update a rating                          |
| GET/POST        | `/api/lists/`                               | Create and list user lists                         |
| DELETE          | `/api/lists/<id>/`                          | Delete a list                                      |
| POST            | `/api/lists/<id>/items/`                    | Add an item to a list                              |
| DELETE          | `/api/lists/<id>/items/clear/`              | Remove all items from a list (keeps the list)      |
| DELETE          | `/api/lists/<id>/items/<item_id>/`          | Remove an item from a list                         |
| GET             | `/api/stats/`                               | Watch history statistics                           |
| GET/POST/PATCH/DELETE | `/api/episode-progress/<show_id>/`    | Get/set/update/delete episode progress             |
| GET/POST        | `/api/followed-people/`                     | List followed people / follow a person             |
| DELETE          | `/api/followed-people/<person_id>/`         | Unfollow a person                                  |
| GET             | `/api/recommendations/for-you/`             | Trending + genre-based recommendations             |
| GET             | `/api/recommendations/personalized/`        | K-means clustered personalized recommendations     |
| GET             | `/api/recommendations/followed-people/`     | Top-rated credits from followed people             |
| GET             | `/api/tmdb-auth/request-token/`             | Start TMDB OAuth flow                              |
| POST            | `/api/tmdb-auth/create-session/`            | Complete TMDB OAuth, store session                 |
| GET             | `/api/tmdb-auth/status/`                    | Check if TMDB account is connected                 |
| DELETE          | `/api/tmdb-auth/disconnect/`                | Disconnect TMDB account                            |

---

## Roadmap

**Planned:**
- [ ] In-app notifications for new releases from followed people
- [ ] Auto-next episode workflow on TV detail pages
- [ ] Pagination on `/api/lists/` (watchlist/watched/ratings/followed-people are already paginated)
- [ ] Shared `MediaGrid` component + filter/sort hook to de-duplicate `WatchedPage`/`WatchlistPage`
- [ ] Merge `SearchPage`'s `usePaginatedSearch` onto the shared `usePaginatedFetch` hook

**Considering:**
- [ ] PWA / offline support (Service Workers for poster caching)
- [ ] Regional watch provider switching
- [ ] Per-person or per-list iCal export

---

## Contributors

[![Contributors](https://contrib.rocks/image?repo=SanjayJoshi116/movie-app-v2)](https://github.com/SanjayJoshi116/movie-app-v2/graphs/contributors)

---

## License

MIT © 2026 [SanjayJoshi116](https://github.com/SanjayJoshi116)

See [LICENSE](LICENSE) for the full text.
