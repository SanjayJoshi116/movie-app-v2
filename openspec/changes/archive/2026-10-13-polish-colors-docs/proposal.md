## Why

Backlog item 21b (from the 2026-10-09 audits). Hardcoded colors the light/dark theme work missed still make parts of light mode hard to read, or off-palette:
- Idle action icons are pure black.
- Empty-state icons and a card caption are `#aaa` on cream.
- The poster placeholder is a dark navy block in both themes.

The docs and comments have also drifted from the code they describe. A wrong instruction in `CLAUDE.md` or ARCHITECTURE.md gets followed, so the drift costs more than its size suggests.

## What Changes

- **Action icon colors:**
  - The watched and watchlist icons on cards, detail pages, Search, Watchlist and For You take their idle color from one place: gold in dark mode, the theme's text color in light mode.
  - The "in watchlist" blue becomes a named constant.
  - This replaces 11 inline `theme === "dark" ? RATING_GOLD : "#000000"` copies and 3 inline `"#1677ff"`.
- **Muted colors from theme tokens:**
  - Empty-state icons (Movies, TV, Calendar, For You, Search) and Watchlist's review caption.
  - The genre chips' border in the filter panel.
  - `PosterPlaceholder`'s background and text.
- **Text on fixed fills** (the gold watchlist/watched count badge, Stats' FILM/TV badge, avatar initials): these use named constants instead of inline `"#000"`/`"#fff"`. Their fill is the same in both themes, so the text color stays fixed.
- **Avatar initials in `BottomNav`** use `FONT_SIZE.caption` instead of `fontSize: 10`.
- **Fixes:**
  - The browser tab title becomes "CINE DB", matching the manifest.
  - `start.py` falls back to `POSTGRES_PASSWORD` like `settings.py` does.
  - `CORS_ALLOWED_ORIGINS` is documented in `backend/.env.example` and the README.
- **Docs and comments drift:**
  - ARCHITECTURE.md's scroll-restoration bullet: RecommendationsPage has no sort to persist, and ListsPage persists its search/sort filters, not "the selected list id".
  - `CLAUDE.md`: `playwright-core` is a dependency of `@playwright/test`, not a direct devDependency.
  - `settings.py`: two mojibake `â€”` comments, and a CORS comment still saying dev is cross-origin.
  - The `api-hardening` spec: the TMDB proxy forwards repeated values of a parameter in order, but groups parameters by name. The spec claimed "the same order" overall.

Dropped after re-checking:
- **The `browseFilters.ts` comment:** it's about genres, which really are cleared in an effect.
- **The Stats chart palette and heatmap greens:** they're fixed on purpose. Chart series need distinct hues in both themes, and the heat scale is documented as fixed.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `theme-readability`: added that action icons, empty-state icons, card captions and the no-poster placeholder follow the active theme.
- `app-identity`: added that the browser tab title is "CINE DB".
- `api-hardening`: the "forwards query parameters faithfully" wording matches the real guarantee, which is every value forwarded and repeated values kept in order.

## Impact

- **Frontend:**
  - Components: `Movie.tsx`, `TVShowCard.tsx`, `MovieDetails.tsx`, `TVShowDetails.tsx`, `Movies.tsx`, `TVShows.tsx`, `PosterPlaceholder.tsx`, `BottomNav.tsx`, `Sidebar.tsx`, `layout/FilterPanel.tsx`.
  - Pages: `SearchPage.tsx`, `WatchlistPage.tsx`, `RecommendationsPage.tsx`, `CalendarPage.tsx`, `StatsPage.tsx` (badge text only).
  - Constants: `constants/ui.ts`, plus one new small hook.
  - `public/index.html`.
- **Backend:** `start.py`, plus `settings.py` comments only.
- **Docs:** `backend/.env.example`, `README.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/BUG_BACKLOG.md`, and the `api-hardening` spec.
- **Visual:**
  - Light mode: idle icons go from pure black to the theme's text color, and the placeholder becomes a light fill.
  - Dark mode: the placeholder shifts slightly to the theme's fill token.
- **No API or behavior changes otherwise.**
