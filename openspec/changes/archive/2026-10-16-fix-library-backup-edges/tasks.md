## 1. Watchlist filter on the watched history

- [x] 1.1 `useWatched.ts`: add `hasLoaded` (generation of the last successful load equals the current session's), set in the success path only; expose it through `WatchedContext`
- [x] 1.2 `WatchlistPage.tsx`: with the filter on, `!hasLoaded && error` → `LoadError` (Retry), `!hasLoaded` → `SkeletonCard`, `hasLoaded` → the filtered grid; clamp `filterReady` = filter off or `hasLoaded`
- [x] 1.3 Update every test mock of `useWatchedContext`/`useWatched` that the page reads (`WatchlistPagination.test.tsx`, others found by grep) with `hasLoaded`
- [x] 1.4 Jest: still-loading history shows the placeholder (not all titles, not "No items match"); a failed background reload keeps the filtered titles and no error in their place; the item-43 cases still pass; a `useWatched` test that `hasLoaded` stays true after a failed reload and resets on sign-out

## 2. Backup and CSV column rules

- [x] 2.1 `csvParse.ts`: add `parseRuntime`, `parseBoundedText`, `parseUserRating`, `parseTitle` and the bound constants (pointing at `serializers.py`); use them plus `normalizeWatchedAt` for every column `parseBackupCSV` reads, dropping a review over 5,000; keep `parseScore(...) ?? 0`
- [x] 2.2 `parseCSVForImport`: use the same helpers for runtime, platform, time zone and title (title cut to 500)
- [x] 2.3 `CSVImportAllModal.tsx` `enrichPosterPaths`: comment states the decided rule (a backup's score is taken as given, never looked up)
- [x] 2.4 Jest (`csvParse.test.ts`): backup rows drop runtime -5 / 1.5, platform 120 chars, zone 70 chars, future and pre-1900 times, rating 11 / 0.3 / 7.3, review 6,000 chars; title 700 → 500 in both readers; other rows untouched
- [x] 2.5 Jest (import-all): a ratings section with one out-of-range rating restores the others and isn't reported as failed

## 3. Detail page titles and id changes

- [x] 3.1 `usePageTitle.ts` `detailPageTitle`: error heading only on `error`; a settled record without a name → generic
- [x] 3.2 Confirm the id-change case needs no code: `App.tsx`'s `<Routes location={location} key={location.pathname}>` already remounts a page for a new id (found while implementing; no `KeyedByParam` wrapper)
- [x] 3.3 Jest: loaded movie with `title: ""` → "Movie · CINE DB"; with `<Routes>` keyed on the pathname as in `App.tsx`, navigating `/person/1` → `/person/2` never emits "Person 1 · CINE DB" settled after the move and doesn't render person 1 there

## 4. Docs and verification

- [x] 4.1 CLAUDE.md: imports bullet (one parser per column, every bounded field dropped per row, backup score taken as given); page-title bullet (generic title for a nameless record; detail routes remount per id); library hooks note on `hasLoaded`
- [x] 4.2 `docs/BUG_BACKLOG.md`: item 44 row named `fix-library-backup-edges` 📝 (✅ on archive), decision recorded
- [x] 4.3 `npm run typecheck`, `npm run lint`, full Jest (`--maxWorkers=2`), and `npx playwright test e2e/import.spec.ts e2e/a11y-titles.spec.ts e2e/library-filters.spec.ts`
