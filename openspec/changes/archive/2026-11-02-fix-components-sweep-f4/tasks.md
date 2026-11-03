## 1. Imports

- [x] 1.1 `CSVUploadModal` and `CSVImportAllModal` take an optional `onBusyChange` and report `loading` (cleanup reports `false`); `ProfileModalBody` folds it into `busy`
- [x] 1.2 Latest-pick guard (`pickRef`) in all three import dialogs' file handlers; file input `disabled={loading}`
- [x] 1.3 `CSVImportAllModal` shows `showError(getApiError(err, "Import failed. Please try again."))` for non-session errors instead of rethrowing
- [x] 1.4 `CSVListImportModal` template through `downloadCSV` with `templateRows` mapped to `{ id, title }`; drop the hand-built rows
- [x] 1.5 Jest: Escape during a running import leaves Edit Profile open; a slower earlier parse doesn't replace a later pick; file input disabled while importing; an unexpected error shows a toast and re-enables Import All; the template download goes through `downloadCSV` with two columns

## 2. Detail pages and episode tracking

- [x] 2.1 `MovieDetails`/`TVShowDetails` watchlist button calls `add`/`remove` from `useWatchlistContext()` based on the rendered state; toast from the same value
- [x] 2.2 Remove `toggleWatchlist` from `useAppContext` and `types/context.ts`; update mocks in tests and e2e that reference it
- [x] 2.3 `getMaxEpisodes` returns `null` for missing/0 counts; editor caps and `/n` only for a number; "Next Episode" skips a listed season with 0 episodes
- [x] 2.4 Jest: detail-page watchlist click runs `add` when shown as not in watchlist even if state changed, and `remove` when shown in; 0-episode season editor `+` goes to 2 with no `/0`; no Next Episode into a 0-episode season

## 3. Accessibility and cards

- [x] 3.1 `Movies.tsx`/`TVShows.tsx`: `<section aria-label>` instead of `<main>`
- [x] 3.2 `RouteAnnouncer.announce` clears the message, then sets the title on the next frame; cleanup cancels it
- [x] 3.3 `MarqueeTitle` re-measures after `document.fonts.ready` (guarded, cancelled on cleanup)
- [x] 3.4 `MediaCard` mounts `MarkWatchedModal` only after it was first opened
- [x] 3.5 Jest: one `main` on the grid page render; same title announced twice across two navigations; marquee gets its `title` after a mocked `fonts.ready` with a wider text; card renders no Mark as Watched dialog until opened

## 4. Docs and checks

- [x] 4.1 CLAUDE.md: import dialogs report busy to Edit Profile; detail pages listed under explicit add/remove; `toggleWatchlist` gone; backlog item 61 marked proposed
- [x] 4.2 Run Jest (full, `--maxWorkers=2`), typecheck, lint; e2e only the touched specs (import, detail-and-nav, accessibility/a11y titles, responsive landmarks if any)
