# CINE DB

A personal movie and TV show discovery app powered by the [TMDB API](https://www.themoviedb.org/documentation/api), with a Django + PostgreSQL backend for user accounts and persistent data.

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
- **Recommendations** — Personalized suggestions based on your watch history, plus "Because you watched X" sections and recommendations from people you follow (`/recommendations`)
- **Release Calendar** — 60-day lookahead of upcoming releases, grouped by date, fetching up to 3 pages per type (`/calendar`)

### Auth
- **Login / Register** — JWT-based auth; tokens stored in `localStorage`
- **Password Reset** — Email-based: enter your account email, receive a reset link, set a new password via the link

### UI & UX
- **Skeleton Loaders** — Content placeholders while data loads
- **Toast Notifications** — Feedback on watchlist, watched, list, follow, and rating actions
- **Dark / Light Mode** — Cinema-dark (`#0d0f1a`) and light themes; preference saved per account
- **Animated UI** — Page transitions and card hover effects via Framer Motion
- **Responsive Layout** — Persistent sidebar on desktop; fixed bottom nav with overflow drawer on mobile

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+ (Anaconda recommended)
- PostgreSQL
- A free [TMDB API key](https://developer.themoviedb.org/docs/getting-started)

### Setup

1. Install frontend dependencies:

```bash
npm install
```

2. Create a `.env` file in the project root (frontend + Express proxy):

```
TMDB_API_KEY=your_tmdb_api_key_here
```

3. Create a `.env` file inside `backend/` (Django):

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

4. Set up the Python environment and install backend dependencies:

```bash
pip install -r backend/requirements.txt
```

5. Configure your PostgreSQL database (or use the `DB_*` variables above).

6. Run Django migrations:

```bash
python backend/manage.py migrate
```

7. Start all three servers together:

```bash
npm run dev
```

The React app runs at `http://localhost:3000`. The Express proxy runs at `http://localhost:3001`. The Django API runs at `http://localhost:8000`.

> **Note:** All three must be running for the app to work fully. `npm run dev` starts them together using `concurrently`.

---

## Scripts

| Command                  | Description                                          |
| ------------------------ | ---------------------------------------------------- |
| `npm run dev`            | Start React, Express proxy, and Django (recommended) |
| `npm start`              | Start React dev server only                          |
| `npm run server`         | Start Express proxy server only                      |
| `npm run django`         | Start Django API server only                         |
| `npm run build`          | Production build                                     |
| `npm test`               | Run Jest unit tests                                  |
| `npx playwright test`    | Run E2E tests (starts React dev server automatically)|

---

## Architecture

```
backend/
├── cinedb/
│   ├── settings.py              # Django settings (PostgreSQL, JWT, CORS, email)
│   └── urls.py                  # Root URL config — mounts /api/
├── userdata/
│   ├── models.py                # WatchlistEntry, WatchedEntry, RatingEntry,
│   │                            #   UserList, UserListItem, EpisodeProgress, FollowedPerson
│   ├── serializers.py           # DRF serializers (camelCase field aliases)
│   ├── views.py                 # API views (watchlist, watched, ratings, lists,
│   │                            #   stats, episode-progress, followed-people, password reset)
│   ├── urls.py                  # /api/ endpoint routing
│   ├── recommendations.py       # K-means genre clustering + followed-people recommendations
│   └── tmdb_client.py           # Server-side TMDB API client
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
│   ├── ProfileModal.tsx         # Edit profile + change password + TMDB OAuth connect
│   ├── Movie.tsx / Movies.tsx
│   ├── TVShows.tsx
│   ├── MovieDetails.tsx         # Includes add-to-list with checkbox toggle (add + remove)
│   ├── TVShowDetails.tsx        # Includes episode progress tracker; add-to-list with toggle
│   ├── Overlay.tsx              # Video trailer overlay
│   ├── ProtectedRoute.tsx       # Redirects to /login with state.from
│   └── Tags.tsx
├── context/
│   ├── AppContext.tsx            # Global state: theme, search, genres, watchlist, watched, ratings
│   │                            #   exposes reloadWatched() for post-import refresh
│   ├── AuthContext.tsx           # login, register, logout — persists user in localStorage
│   ├── ListsContext.tsx          # User lists state
│   ├── useAppContext.ts
│   └── useListsContext.ts
├── hooks/
│   ├── useWatchlist.ts          # Async CRUD → /api/watchlist/
│   ├── useWatched.ts            # Async CRUD → /api/watched/; includes reload() for bulk-import sync
│   ├── useRatings.ts            # Async CRUD → /api/ratings/
│   ├── useLists.ts              # Async CRUD → /api/lists/ (items carry _itemId for DELETE)
│   ├── useEpisodeProgress.ts    # Fetch/update/delete episode progress → /api/episode-progress/
│   ├── useFollowedPeople.ts     # Follow/unfollow actors & directors → /api/followed-people/
│   ├── useInfiniteScroll.ts     # IntersectionObserver for infinite scroll + scroll restoration
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
│   ├── CalendarPage.tsx         # /calendar — 60-day release lookahead (protected)
│   ├── RecommendationsPage.tsx  # /recommendations — personalized + followed-people recs (protected)
│   ├── LoginPage.tsx            # /login
│   ├── RegisterPage.tsx         # /register
│   ├── ForgotPasswordPage.tsx   # /forgot-password — email-based reset link request
│   ├── ResetPasswordPage.tsx    # /reset-password/:uid/:token — set new password from link
│   └── TMDBCallbackPage.tsx     # /tmdb-callback — completes TMDB OAuth session exchange
├── utils/
│   └── export.ts                # downloadCSV / downloadJSON helpers (Blob + URL.createObjectURL)
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
- **Production config** — `DEBUG`, `ALLOWED_HOSTS`, and `SECRET_KEY` are all env-controlled in `backend/cinedb/settings.py`. When `DEBUG=False`, the app asserts that `SECRET_KEY` and `ALLOWED_HOSTS` are properly set, preventing accidental production runs with insecure defaults.
- **Stable hook callbacks** — `useWatchlist`, `useRatings`, and `useWatched` use `useCallback` with a ref pattern (`watchlistRef.current = watchlist`) so returned functions only change identity when `isAuthenticated` changes, not on every render. This prevents `AppContext`'s `useMemo` from recomputing on unrelated parent re-renders.
- **API key security** — The TMDB key lives in `.env` and is only accessed server-side (Express proxy or Django). Frontend requests go through `/api/tmdb/*`.
- **Backend data** — All user data lives in PostgreSQL, bound to the authenticated user. No localStorage drift.
- **Recommendations** — K-means clustering on rating-weighted genre vectors of the user's watch history (scikit-learn). Followed-people recommendations are fetched in parallel with personal recommendations and shown at the top. Only fetched once on first load (guarded by a `useRef` flag).
- **Filter params by media type** — `filtersToTMDBParams(filters, sortBy, mediaType)` uses `first_air_date` for TV and `primary_release_date` for movies, and remaps `primary_release_date.*` sort options to `first_air_date.*` for TV discover queries.
- **Episode progress bounds** — The tracker reads `number_of_seasons` and `seasons[].episode_count` from the TMDB TV detail response to cap the +/- controls; no extra API call needed.
- **CSV import** — Parses CSV in the browser (handles quoted fields and `""` escaped quotes), enriches with TMDB poster data in batches of 20, bulk-saves via `/api/watched/bulk/`, then calls `reloadWatched()` so the watched list in context updates immediately.
- **CSV export** — Pure browser-side: `Blob` + `URL.createObjectURL`. No server round-trip.
- **Protected routes** — Unauthenticated access to any non-public path redirects to `/login` with `state.from` preserved, handled inline in `AppInner` (`App.tsx`). Public paths: `/login`, `/register`, `/forgot-password`, `/reset-password/*`.
- **Layout** — `App.tsx` uses a plain flex `div.app-shell`: `<Sidebar>` (desktop) + `<main>` + `<BottomNav>` (mobile). No Ant Design Layout wrapper.
- **State** — `AppContext` for global UI state; `AuthContext` for auth; `ListsContext` for lists. Ephemeral page state (loading, pagination) stays local to each page component.
- **Scroll restoration** — HomePage, AnimePage, and PeoplePage encode `scrollY` and `loadedPages` in `navigate()` state when clicking into a detail or person page. On back-navigation, the pages re-fetch the required pages sequentially and restore the scroll position via `useLayoutEffect`.
- **Routing** — React Router v6. Every movie, show, and person has its own URL.
- **TypeScript** — Strict mode. All TMDB response shapes typed in `src/types/tmdb.ts`.
- **UI** — Ant Design 5 with `ConfigProvider`. Cinema-dark uses `#0d0f1a` background and `#f5c518` gold accent. Cards use `rgba` glassmorphism (`.glass-card`, `.glass-sidebar`).
- **Error boundaries** — Root, per-route, and video overlay placements.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register/` | Create account |
| POST | `/api/auth/login/` | Login (returns access + refresh tokens) |
| POST | `/api/auth/token/refresh/` | Refresh access token |
| GET/PATCH | `/api/auth/profile/` | Get or update profile (requires auth) |
| POST | `/api/auth/password-reset/` | Request email password reset link |
| POST | `/api/auth/password-reset/confirm/` | Confirm reset with uid + token + new password |
| GET/POST | `/api/watchlist/` | List or add watchlist entries |
| DELETE/PATCH | `/api/watchlist/<id>/` | Remove or update a watchlist entry |
| GET/POST | `/api/watched/` | List or add watched entries |
| DELETE | `/api/watched/<id>/` | Remove a watched entry |
| DELETE | `/api/watched/clear/` | Remove all watched entries |
| POST | `/api/watched/bulk/` | Bulk-import watched entries (CSV upload) |
| GET/POST | `/api/ratings/` | List or add/update ratings |
| DELETE/PATCH | `/api/ratings/<id>/` | Remove or update a rating |
| GET/POST | `/api/lists/` | Create and list user lists |
| DELETE | `/api/lists/<id>/` | Delete a list |
| POST | `/api/lists/<id>/items/` | Add an item to a list |
| DELETE | `/api/lists/<id>/items/<item_id>/` | Remove an item from a list |
| GET | `/api/stats/` | Watch history statistics |
| GET/POST/PATCH/DELETE | `/api/episode-progress/<show_id>/` | Get/set/update/delete episode progress |
| GET/POST | `/api/followed-people/` | List followed people / follow a person |
| DELETE | `/api/followed-people/<person_id>/` | Unfollow a person |
| GET | `/api/recommendations/for-you/` | Trending + genre-based recommendations |
| GET | `/api/recommendations/personalized/` | K-means clustered personalized recommendations |
| GET | `/api/recommendations/followed-people/` | Top-rated credits from followed people |
| GET | `/api/tmdb-auth/request-token/` | Start TMDB OAuth flow |
| POST | `/api/tmdb-auth/create-session/` | Complete TMDB OAuth, store session |
| GET | `/api/tmdb-auth/status/` | Check if TMDB account is connected |
| DELETE | `/api/tmdb-auth/disconnect/` | Disconnect TMDB account |

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

**APIs**
- [TMDB API](https://developer.themoviedb.org/)
