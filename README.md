# CINE DB

A personal movie and TV show discovery app powered by the [TMDB API](https://www.themoviedb.org/documentation/api).

## Features

- **Browse & Search** — Discover, Now Playing, Top Rated, Upcoming, Popular categories for both movies and TV shows
- **Hero Banner** — Trending movie of the week displayed as a full-width backdrop with title, overview, rating, and a direct link to the detail page
- **Recent Searches** — Search history dropdown (last 5 queries) stored in localStorage
- **Detail Pages** — Full info: cast, crew, videos, images, reviews, recommendations, watch providers; backdrop hero with horizontal cast scroll
- **Person Pages** — Actor/crew bios with full filmography
- **Watchlist** — Save movies and TV shows; persists across sessions via localStorage
- **Watchlist Stats** — Total, watched count, average personal rating, movies vs TV breakdown with a watched-progress bar
- **Ratings & Reviews** — Rate anything 1–10 and write personal notes
- **Advanced Filters** — Filter by year range, TMDB rating, language, runtime (movies), and sort order
- **Genre Tags** — Click to filter by genre
- **Dark / Light Mode** — Cinema-dark (`#0d0f1a`) and light themes with glassmorphism cards; preference saved across sessions
- **Animated UI** — Page transitions and card hover effects via Framer Motion
- **Responsive Layout** — Persistent sidebar on desktop; fixed bottom nav on mobile

## Getting Started

### Prerequisites

- Node.js 16+
- A free [TMDB API key](https://developer.themoviedb.org/docs/getting-started)

### Setup

1. Clone the repo and install dependencies:

```bash
npm install
```

2. Create a `.env` file in the project root:

```
TMDB_API_KEY=your_tmdb_api_key_here
```

3. Start both the Express proxy server and the React app:

```bash
npm run dev
```

The app runs at `http://localhost:3000`. The API proxy runs at `http://localhost:3001`.

> **Note:** Both servers must be running for the app to work. `npm run dev` starts them together using `concurrently`.

## Scripts

| Command          | Description                      |
| ---------------- | -------------------------------- |
| `npm run dev`    | Start both servers (recommended) |
| `npm start`      | Start React dev server only      |
| `npm run server` | Start Express proxy server only  |
| `npm run build`  | Production build                 |
| `npm test`       | Run tests                        |

## Architecture

```
src/
├── api/
│   └── tmdb.ts                  # All TMDB API calls — typed, proxied through Express
├── components/
│   ├── layout/
│   │   └── FilterPanel.tsx      # Advanced filter UI (Ant Design Drawer, right-side)
│   ├── ui/
│   │   └── StarRating.tsx       # Ant Design Rate (1–10, gold, keyboard accessible)
│   ├── watchlist/
│   │   ├── RatingModal.tsx      # Ant Design Modal + Form for rating + review
│   │   └── WatchlistStats.tsx   # Summary stats for the watchlist page
│   ├── ErrorBoundary.tsx        # Reusable error boundary with dev stack trace
│   ├── Sidebar.tsx              # Desktop: persistent 220px left nav (logo, search, menu, theme)
│   ├── BottomNav.tsx            # Mobile: fixed bottom nav (hidden ≥768px)
│   ├── SearchBox.tsx            # Ant Design Dropdown + Input.Search with recent-search history
│   ├── HeroBanner.tsx           # Trending movie hero with backdrop, rating, and CTA
│   ├── Header.tsx               # (kept, unused after sidebar migration)
│   ├── Movie.tsx / Movies.tsx
│   ├── TVShows.tsx
│   ├── MovieDetails.tsx         # Backdrop hero, glass info card, horizontal cast scroll
│   ├── TVShowDetails.tsx        # Same backdrop + glass treatment as MovieDetails
│   ├── Overlay.tsx              # Video trailer overlay
│   ├── Pagination.tsx           # Ant Design Pagination
│   └── Tags.tsx                 # Ant Design Tag.CheckableTag
├── constants/
│   └── genres.ts                # Single source of truth for genre list
├── context/
│   ├── AppContext.tsx            # Global state: theme, search, genres, watchlist, ratings
│   └── useAppContext.ts          # Non-nullable context hook
├── hooks/
│   ├── useLocalStorage.ts       # Generic localStorage hook (functional-update safe)
│   ├── useWatchlist.ts          # Watchlist CRUD
│   ├── useRatings.ts            # Ratings CRUD
│   └── useRecentSearches.ts     # Last 5 searches stored in cinedb_recent_searches
├── pages/
│   ├── HomePage.tsx             # /movies and /tv browse pages with HeroBanner
│   ├── MovieDetailPage.tsx      # /movie/:id
│   ├── TVDetailPage.tsx         # /tv/:id
│   ├── PersonPage.tsx           # /person/:id — Tabs for credits/photos
│   └── WatchlistPage.tsx        # /watchlist — Stats + card grid with Popconfirm for remove
├── theme/
│   └── antdTheme.ts             # Ant Design ConfigProvider tokens: darkThemeConfig / lightThemeConfig
└── types/
    ├── domain.ts                # MediaType, WatchlistEntry, RatingEntry, FilterValues…
    ├── tmdb.ts                  # All TMDB API response shapes
    ├── context.ts               # AppContextType interface
    └── index.ts                 # Barrel re-export
```

**Key design decisions:**

- **API key security** — The TMDB key lives in `.env` and is only used server-side. All frontend requests go to `/api/tmdb/*` on the Express proxy.
- **Persistence** — Watchlist, ratings, theme, and recent searches are stored in `localStorage` under the keys `cinedb_watchlist`, `cinedb_ratings`, `cinedb_theme`, and `cinedb_recent_searches`.
- **Layout** — `App.tsx` uses a plain `div.app-shell` flex container: `<Sidebar>` (desktop) + `<main class="app-content">` + `<BottomNav>` (mobile). No Ant Design Layout wrapper.
- **State** — Single `AppContext` provider. Ephemeral UI state (search term, selected genres) lives in context; page-level state (loading, items, pagination) lives in page components.
- **Routing** — React Router v6. Every movie, show, and person has its own URL — browser back/forward and deep links work correctly.
- **TypeScript** — Strict mode with `noUncheckedIndexedAccess`. All source files are `.ts`/`.tsx`. TMDB response shapes are fully typed in `src/types/tmdb.ts`.
- **UI — Ant Design 5** — `ConfigProvider` wraps the app and switches between `darkThemeConfig` and `lightThemeConfig` based on context. Cinema-dark uses `#0d0f1a` background and `#f5c518` gold accent. Cards use `rgba` glassmorphism backgrounds (`.glass-card`, `.glass-sidebar`, `.glass-overlay-card`). `FilterPanel` renders as a right-side `Drawer`.
- **Error boundaries** — Three placements: root (catastrophic failures), per-route (a detail page crash doesn't unmount the sidebar), and the video overlay. Dev mode shows the stack trace.
- **Accessibility** — Semantic HTML throughout: pagination uses `<button disabled>` with `aria-label`, genre tags use `<button aria-pressed>`, StarRating implements a `role="radiogroup"` with arrow key navigation, modals have `role="dialog"` + `aria-modal` + escape key + auto-focus, nav links have `aria-current="page"`, loading states use `role="status" aria-live="polite"`.

## Testing

Tests cover the core hook and context logic (29 tests, 4 suites):

```
src/hooks/__tests__/
├── useLocalStorage.test.ts   # Storage, functional updates, error handling
├── useWatchlist.test.ts      # Add, remove, toggle, markWatched, persistence
└── useRatings.test.ts        # Set, get, remove, overwrite, ISO timestamp

src/context/__tests__/
└── AppContext.test.tsx        # Provider, theme, search, genres, watchlist, ratings
```

Run with:

```bash
npm test
```

## Tech Stack

- [React 18](https://react.dev/) + [Create React App](https://create-react-app.dev/)
- [TypeScript 5](https://www.typescriptlang.org/) — strict mode
- [React Router v6](https://reactrouter.com/)
- [Ant Design 5](https://ant.design/) + [@ant-design/icons](https://ant.design/components/icon/)
- [Framer Motion](https://www.framer.com/motion/)
- [Express.js](https://expressjs.com/) — API proxy server
- [Axios](https://axios-http.com/)
- [Testing Library](https://testing-library.com/)
- [TMDB API](https://developer.themoviedb.org/)
