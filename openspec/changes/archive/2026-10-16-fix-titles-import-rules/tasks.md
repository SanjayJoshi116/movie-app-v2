## 1. Page titles on detail and person pages

- [x] 1.1 `MovieDetailPage.tsx`: move the not-found and error headings into constants used by both `LoadError` and the title; derive the title name from state (`id === null` → "Page Not Found", not-found heading, error heading, else `movie?.title ?? "Movie"`), `loading` true only while a valid id loads; drop the "NotFoundPage names itself" comment
- [x] 1.2 Same for `TVDetailPage.tsx` ("TV show not found", "Failed to load TV show details") and `PersonPage.tsx` ("Person not found", "Failed to load this person")
- [x] 1.3 Jest: for each of the three pages, an invalid id leaves `document.title` as "Page Not Found · CINE DB"; a 404 and a failed load set the matching heading title with `loading` false (announced through `RouteAnnouncer`, generic title never announced); a successful load keeps the loaded name

## 2. Watchlist filter on failed watched data

- [x] 2.1 `WatchlistPage.tsx`: with `watchedFilter !== "all"` and the watched history's `error` set, render `LoadError` ("Couldn't load your watched history", Retry → `WatchedContext.reload`, errors swallowed) instead of the filtered grid or its empty state; the filter bar stays
- [x] 2.2 Jest (extend `WatchlistPagination.test.tsx` or a sibling): failed watched history + "Watched" filter shows the error, not "No items match your filters."; Retry that succeeds shows the grid on the address's page; switching to "All" shows the full grid

## 3. One lookup rule for every import

- [x] 3.1 `src/utils/importPosters.ts`: `lookupImportPosters` accepts rows with optional `posterPath`/`voteAverage`, looks up only rows missing either, returns `found[i]` per input row merged file-first, and `missing` = rows whose final poster is null; update its doc comment
- [x] 3.2 `CSVUploadModal.tsx`: pass the parsed values in, drop the local `toLookUp` filter/remap and the file-first merge
- [x] 3.3 `lists/CSVListImportModal.tsx`: pass the parsed values in so covered rows aren't looked up and the file's values are kept
- [x] 3.4 `lists/CSVImportAllModal.tsx` `enrichPosterPaths`: pass all rows with their values, write back `posterPath` only
- [x] 3.5 Jest for `lookupImportPosters`: covered rows make no request, partial rows are looked up, the file's poster survives a failed lookup, `missing` counts final null posters
- [x] 3.6 Jest: the list import of a file with posters and scores makes no lookup and saves the file's values; the existing `CSVUploadModalLookups` and import-all tests still pass

## 4. Shared CSV column parsers

- [x] 4.1 `src/utils/csvParse.ts`: add `parseScore` and `parsePosterPath` next to `parsePositiveInt`; use them in `parseCSVForImport` (same behavior) and in `parseBackupCSV` (`?? 0` and `?? null`)
- [x] 4.2 Jest (`csvParse.test.ts`): backup rows drop a 600-character or non-`/` `poster_path` and turn `vote_average` 11 / `abc` into 0, other rows unchanged

## 5. Docs and verification

- [x] 5.1 CLAUDE.md: page-title bullet says a detail page's title follows its not-found/error state; imports bullet says the skip-and-merge rule lives in `lookupImportPosters`
- [x] 5.2 `docs/BUG_BACKLOG.md`: item 43 row named `fix-titles-import-rules` 📝, then ✅ on archive; mark the three not-changed findings as checked
- [x] 5.3 `npm run typecheck`, `npm run lint`, the touched Jest suites (`--maxWorkers=2`), and `npx playwright test e2e/import.spec.ts e2e/a11y-titles.spec.ts`
