## 1. Certification guard (load-states)

- [x] 1.1 In `MovieDetails.tsx` `renderCertifications`, read each entry's `release_dates` through `arrayOr` and its `iso_3166_1` with optional chaining, so a null or malformed country entry is skipped
- [x] 1.2 Add a Jest test that renders `MovieDetails` (or tests the exported helper) with one country entry missing `release_dates` and one null entry: the page renders and the certification comes from the valid entry

## 2. Page titles and the route announcer (accessibility)

- [x] 2.1 `usePageTitle(name, { loading })`: emit `{ title, loading }` on `[title, loading]`, and emit a cleared event on unmount (alongside resetting `document.title`). Update the doc comment: pass `loading: false` once the load settles either way
- [x] 2.2 Pass the loading state from `MovieDetailPage`, `TVDetailPage`, `PersonPage` (their `loading`) and `ListDetailPage` (the lists context's `isLoading`)
- [x] 2.3 `RouteAnnouncer`: after a pathname change, run the settle timer only while the latest emission is a final (non-loading) title. A cleared or loading emission cancels it, and a new final title restarts it
- [x] 2.4 `RouteAnnouncer`: replace the `first` ref with a `lastPath` ref seeded with the initial pathname, so StrictMode's replay doesn't announce the first load
- [x] 2.5 Extend `RouteAnnouncer.test.tsx`: slow detail (generic title not announced, loaded name is), failed detail load (generic announced), lazy page (previous title not announced while the new page hasn't rendered), same-component param change (old name not announced), first load under `<React.StrictMode>` not announced, A → B → A announced

## 3. Watchlist clamp (library-filters)

- [x] 3.1 In `WatchlistPage.tsx`, read `isLoading`/`error` from `useWatchedContext()` and run the clamp only when the watched filter is "all" or the watched history has loaded without error
- [x] 3.2 Add a Jest test: `?page=3` with the "Watched" filter restored, the watchlist loaded and the watched history still loading keeps page 3, and after it loads page 3 shows

## 4. Mark as Watched region change (mark-watched)

- [x] 4.1 In `MarkWatchedModal.tsx`, keep the fetched providers `results` in state, drop `userRegion` from the fetch effect's deps, and derive the platform options with `useMemo` over providers + `userRegion`
- [x] 4.2 Add a test to `MarkWatchedModal.test.tsx`: type a runtime, change the region while the dialog is open, and the runtime is kept, the options follow the new region, and no second details request is made

## 5. CSV import (data-backup)

- [x] 5.1 In `csvParse.ts`, add `MAX_POSTER_PATH_LENGTH = 500` and drop a longer `poster_path` for that row. Read `vote_average` into the parsed row when it's a finite number in 0–10
- [x] 5.2 In `CSVUploadModal.tsx`, look up only rows missing a poster or a score, map the results back by original index, prefer the file's poster and score over the lookup's, and count "saved without a poster" from the final poster values. Skip the lookup (and its progress) entirely when no row needs it
- [x] 5.3 Extend `csvParse.test.ts` (oversized poster dropped, other fields kept; `vote_average` read, out-of-range or non-numeric dropped) and `CSVUploadModal.test.ts` (all rows complete → no lookup; mixed file → only incomplete rows looked up; missing-poster count)

## 6. Reduced motion (accessibility)

- [x] 6.1 In `StatsPage.tsx`, read `useReducedMotion()` in the page component and pass `isAnimationActive={!reduceMotion}` to every `Pie`, `Bar` and `Area`
- [x] 6.2 Use `behavior: reduceMotion ? "auto" : "smooth"` for the page-change scroll in `WatchlistPage.tsx` and `WatchedPage.tsx`, and for Calendar's jump-to-date `scrollIntoView` in `CalendarPage.tsx`
- [x] 6.3 Add Jest coverage that, with reduced motion mocked on, the page-change scroll is called with `behavior: "auto"` (one page is enough) and Stats' series get `isAnimationActive={false}`

## 7. Verify and document

- [x] 7.1 `npm run typecheck`, `npm run lint`, and the full Jest suite (`--maxWorkers=2` if the known 5 s timeouts appear in untouched suites)
- [x] 7.2 Run the touched e2e specs only: `e2e/a11y-titles.spec.ts`, `e2e/import.spec.ts`, `e2e/detail-and-nav.spec.ts`, and update any that assumed every imported row is looked up
- [x] 7.3 Update CLAUDE.md where it describes these conventions (usePageTitle's `loading` option and the announcer, reduced motion covering Recharts and JS scrolls, the import skipping complete rows), and mark backlog item 42 in `docs/BUG_BACKLOG.md` with this change's name and status
