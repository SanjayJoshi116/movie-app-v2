## Why

The F4 module review (backlog item 61) found ten verified bugs in `src/components`. Two of them are high severity:
- Pressing Escape during an import closes Edit Profile and unmounts the import while its writes keep running, so a second restore can start beside the first.
- The movie and TV detail pages' watchlist buttons still toggle, against the rule that every watched/watchlist button runs the action it shows.

The rest are smaller import, episode-tracking, accessibility and consistency gaps.

## What Changes

- **Imports:**
  - An import in progress holds Edit Profile too: neither dialog closes until the run finishes.
  - Only the latest file pick is parsed and shown.
  - The file input is disabled while an import runs.
  - An unexpected Import All failure shows an error instead of failing silently.
- **Detail pages:** the watchlist button calls explicit add/remove. `toggleWatchlist` is removed from the app context so it can't come back.
- **Episode tracking:** a season TMDB lists with 0 episodes (or without a count) puts no cap on the episode editor. "Next Episode" doesn't move into a season with no episodes.
- **Accessibility:**
  - The Movies and TV grids use a labelled `<section>`, not a second `<main>`.
  - A navigation to a page with the same title as the previous one is still announced.
  - Long titles re-check their overflow once the web font loads, so a cut title always has its full-name tooltip.
- **Consistency and cost:**
  - The list-import template CSV goes through the shared CSV writer.
  - Each browse card mounts its Mark as Watched dialog only once it has been opened.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `data-backup`: an import holds the dialog that opened it; only the latest file pick is imported; an unexpected import failure is reported.
- `write-feedback`: the detail pages are named among the places watchlist buttons run the action they show.
- `accessibility`: one main landmark per page; same-title navigations are announced; shortened titles stay readable after the font loads.
- `title-details`: episode tracking never offers an episode or season that has no episodes.

## Impact

- Frontend only:
  - `ProfileModal.tsx`, `CSVUploadModal.tsx`, `lists/CSVImportAllModal.tsx`, `lists/CSVListImportModal.tsx`
  - `MovieDetails.tsx`, `TVShowDetails.tsx`
  - `context/useAppContext.ts`, `types/context.ts`
  - `Movies.tsx`, `TVShows.tsx`, `RouteAnnouncer.tsx`, `MarqueeTitle.tsx`, `MediaCard.tsx`
- Tests: Jest for each fix. Run the touched e2e specs (import, detail-and-nav, accessibility, a11y titles).
- No backend change, no dependency.
