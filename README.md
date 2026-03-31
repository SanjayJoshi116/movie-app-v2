# CINE DB

A personal movie and TV show discovery app powered by the [TMDB API](https://www.themoviedb.org/documentation/api), with a Django + PostgreSQL backend for user accounts and persistent data.

## Features

- **Browse & Search** — Discover, Now Playing, Top Rated, Upcoming, and Popular categories for movies, TV shows, and anime; dedicated Search page with live results
- **Hero Banner** — Trending movie of the week as a full-width backdrop with title, overview, rating, and direct link
- **Recent Searches** — Search history dropdown (last 5 queries)
- **Detail Pages** — Full info: cast, crew, videos, images, reviews, recommendations, watch providers, streaming availability; backdrop hero with horizontal cast scroll
- **Episode Guide** — Season/episode breakdown on TV detail pages
- **Person Pages** — Actor/crew bios with full filmography
- **Watchlist & Watched** — Save and track movies/TV shows; tied to your account
- **Watchlist Stats** — Total, watched count, average personal rating, movies vs TV breakdown with progress bar
- **Ratings & Reviews** — Rate anything 1–10 and write personal notes
- **User Lists** — Create named lists and add any movie or show to them
- **Release Calendar** — 60-day lookahead of upcoming releases, grouped by date (`/calendar`)
- **Recommendations** — Genre-aware suggestions based on your watch history, plus "Because you watched X" sections (`/recommendations`)
- **Streaming Badges** — JustWatch-powered provider badges on watchlist/watched cards and TV detail pages
- **Advanced Filters** — Filter by year range, TMDB rating, language, runtime, and sort order
- **Genre Tags** — Click any genre to filter results
- **Infinite Scroll** — Home and Anime pages load more as you scroll
- **Skeleton Loaders** — Content placeholders while data loads
- **Toast Notifications** — Feedback on watchlist/list actions
- **Dark / Light Mode** — Cinema-dark (`#0d0f1a`) and light themes; preference saved per account
- **Animated UI** — Page transitions and card hover effects via Framer Motion
- **Responsive Layout** — Persistent sidebar on desktop; fixed bottom nav with overflow drawer on mobile

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

2. Create a `.env` file in the project root:

```
TMDB_API_KEY=your_tmdb_api_key_here
```

3. Set up the Python environment and install backend dependencies:

```bash
pip install -r backend/requirements.txt
```

4. Configure your PostgreSQL database in `backend/cinedb/settings.py` under `DATABASES`.

5. Run Django migrations:

```bash
python backend/manage.py migrate
```

6. Start all three servers together:

```bash
npm run dev
```

The React app runs at `http://localhost:3000`. The Express proxy runs at `http://localhost:3001`. The Django API runs at `http://localhost:8000`.

> **Note:** All three must be running for the app to work fully. `npm run dev` starts them together using `concurrently`.

## Scripts

| Command           | Description                                         |
| ----------------- | --------------------------------------------------- |
| `npm run dev`     | Start React, Express proxy, and Django (recommended)|
| `npm start`       | Start React dev server only                         |
| `npm run server`  | Start Express proxy server only                     |
| `npm run django`  | Start Django API server only                        |
| `npm run build`   | Production build                                    |
| `npm test`        | Run tests                                           |

## Architecture

```
backend/
├── cinedb/
│   ├── settings.py              # Django settings (PostgreSQL, JWT, CORS)
│   └── urls.py                  # Root URL config — mounts /api/
├── userdata/
│   ├── models.py                # WatchlistEntry, WatchedEntry, RatingEntry, UserList, UserListItem
│   ├── serializers.py           # DRF serializers
│   ├── views.py                 # API views
│   ├── urls.py                  # /api/ endpoint routing
│   ├── recommendations.py       # Genre-based recommendation logic
│   └── tmdb_client.py           # Server-side TMDB API client
└── manage.py

src/
├── api/
│   ├── tmdb.ts                  # TMDB API calls — typed, proxied through Express
│   └── userApi.ts               # Axios instance with Bearer token + auto 401 refresh
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
│   ├── HeroBanner.tsx           # Trending movie hero with backdrop and CTA
│   ├── SkeletonCard.tsx         # Skeleton placeholder for media cards
│   ├── StreamingBadges.tsx      # JustWatch provider logos
│   ├── EpisodeGuide.tsx         # Season/episode list for TV detail pages
│   ├── Movie.tsx / Movies.tsx
│   ├── TVShows.tsx
│   ├── MovieDetails.tsx
│   ├── TVShowDetails.tsx
│   ├── Overlay.tsx              # Video trailer overlay
│   ├── Pagination.tsx
│   ├── ProtectedRoute.tsx       # Redirects to /login with state.from
│   └── Tags.tsx
├── context/
│   ├── AppContext.tsx            # Global state: theme, search, genres, isDataLoading
│   ├── AuthContext.tsx           # login, register, logout — persists user in localStorage
│   ├── ListsContext.tsx          # User lists state
│   ├── useAppContext.ts
│   └── useListsContext.ts
├── hooks/
│   ├── useWatchlist.ts          # Async CRUD → /api/watchlist/
│   ├── useWatched.ts            # Async CRUD → /api/watched/
│   ├── useRatings.ts            # Async CRUD → /api/ratings/
│   ├── useLists.ts              # Async CRUD → /api/lists/ (items carry _itemId for DELETE)
│   ├── useInfiniteScroll.ts     # IntersectionObserver for infinite scroll + scroll restoration
│   ├── useToast.ts              # App.useApp() toast wrapper
│   ├── useLocalStorage.ts       # Generic localStorage hook
│   └── useRecentSearches.ts     # Last 5 searches
├── pages/
│   ├── HomePage.tsx             # /movies and /tv browse with HeroBanner + infinite scroll
│   ├── SearchPage.tsx           # /search — live results across movies, TV, and people
│   ├── AnimePage.tsx            # /anime — filtered TV browse
│   ├── MovieDetailPage.tsx      # /movie/:id
│   ├── TVDetailPage.tsx         # /tv/:id
│   ├── PersonPage.tsx           # /person/:id
│   ├── PeoplePage.tsx           # /people — popular people browse
│   ├── WatchlistPage.tsx        # /watchlist (protected)
│   ├── WatchedPage.tsx          # /watched (protected)
│   ├── ListsPage.tsx            # /lists (protected)
│   ├── CalendarPage.tsx         # /calendar (protected) — 60-day release lookahead
│   ├── RecommendationsPage.tsx  # /recommendations (protected)
│   ├── LoginPage.tsx            # /login
│   └── RegisterPage.tsx         # /register
├── theme/
│   └── antdTheme.ts             # Ant Design ConfigProvider tokens: dark / light
└── types/
    ├── domain.ts                # MediaType, WatchlistEntry, RatingEntry, UserList…
    ├── tmdb.ts                  # All TMDB API response shapes
    ├── context.ts               # AppContextType, AuthContextType
    └── index.ts                 # Barrel re-export
```

**Key design decisions:**

- **Auth** — JWT via `djangorestframework-simplejwt`. Access + refresh tokens stored in `localStorage`. `userApi.ts` intercepts 401s and silently refreshes before retrying.
- **API key security** — The TMDB key lives in `.env` and is only accessed server-side (Express proxy or Django). Frontend requests go through `/api/tmdb/*`.
- **Backend data** — All user data (watchlist, watched, ratings, lists) lives in PostgreSQL, bound to the authenticated user. No more localStorage drift.
- **Protected routes** — `/watchlist`, `/watched`, `/lists`, `/recommendations`, `/calendar` all require login via `ProtectedRoute`, which preserves the intended destination in `state.from`.
- **Lists** — `useLists.ts` tracks `_itemId` (Django PK) on each list item for correct DELETE calls.
- **Layout** — `App.tsx` uses a plain flex `div.app-shell`: `<Sidebar>` (desktop) + `<main>` + `<BottomNav>` (mobile). No Ant Design Layout wrapper.
- **State** — `AppContext` for global UI state; `AuthContext` for auth; `ListsContext` for lists. Ephemeral page state (loading, pagination) stays local to each page component.
- **Routing** — React Router v6. Every movie, show, and person has its own URL.
- **TypeScript** — Strict mode. All TMDB response shapes typed in `src/types/tmdb.ts`.
- **UI** — Ant Design 5 with `ConfigProvider`. Cinema-dark uses `#0d0f1a` background and `#f5c518` gold accent. Cards use `rgba` glassmorphism (`.glass-card`, `.glass-sidebar`).
- **Error boundaries** — Root, per-route, and video overlay placements. Dev mode shows stack traces.

## Testing

Tests cover core hook and context logic (29 tests, 4 suites):

```
src/hooks/__tests__/
├── useLocalStorage.test.ts
├── useWatchlist.test.ts
└── useRatings.test.ts

src/context/__tests__/
└── AppContext.test.tsx
```

Run with:

```bash
npm test
```

## Tech Stack

**Frontend**
- [React 18](https://react.dev/) + [Create React App](https://create-react-app.dev/)
- [TypeScript 5](https://www.typescriptlang.org/) — strict mode
- [React Router v6](https://reactrouter.com/)
- [Ant Design 5](https://ant.design/) + [@ant-design/icons](https://ant.design/components/icon/)
- [Framer Motion](https://www.framer.com/motion/)
- [Axios](https://axios-http.com/)
- [Express.js](https://expressjs.com/) — TMDB API proxy

**Backend**
- [Django 4](https://www.djangoproject.com/) + [Django REST Framework](https://www.django-rest-framework.org/)
- [djangorestframework-simplejwt](https://django-rest-framework-simplejwt.readthedocs.io/) — JWT auth
- [PostgreSQL](https://www.postgresql.org/) + [psycopg2](https://www.psycopg.org/)

**APIs**
- [TMDB API](https://developer.themoviedb.org/)
