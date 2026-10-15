## 1. Region

- [x] 1.1 `src/utils/region.ts` (`deviceRegion`, `regionName`, `pickRegion`) + Jest
- [x] 1.2 `UIContext`: `region`/`setRegion` (`useLocalStorage("cinedb_region", deviceRegion())`), kept across sign-out
- [x] 1.3 `WatchProviders`, `MovieDetails` certification, `MarkWatchedModal` platforms use `pickRegion`; labels name the region, fallback labelled as US
- [x] 1.4 `fetchProviderRegions` (`/watch/providers/regions` via `sharedGet`) + Region select in Edit Profile; live shape check in `test_tmdb_live.py`
- [x] 1.5 Tests: Jest for `WatchProviders` (region, US fallback, none); e2e: changing the region in Edit Profile changes Where to Watch

## 2. Watchlist pagination

- [x] 2.1 `WatchlistPage`: page/pageSize URL params, clamp to a non-empty page once loaded, slice, `Pagination`, filters reset to page 1
- [x] 2.2 e2e: a long watchlist shows one page; removing the last item on the last page moves back

## 3. Imports and lists

- [x] 3.1 Watched CSV export adds `runtime_minutes`, `platform`, `poster_path`; `parseCSVForImport` reads them; `CSVUploadModal` sends them (row poster preferred) + Jest
- [x] 3.2 `onerror` on both CSV modals' `FileReader` → "Couldn't read that file." + Jest
- [x] 3.3 `CSVImportAllModal`: a list that couldn't be created counts as failed, even empty; result says so + test
- [x] 3.4 `ListDetailPage`: `LoadError notFound` for a missing list (lists loaded); Retry stays for a failed load + test

## 4. Copy, docs, deps

- [x] 4.1 For You tooltip describes the real sources
- [x] 4.2 README: 44 endpoints; features (region, Watchlist pagination)
- [x] 4.3 Bump Pillow, requests, psycopg2-binary to latest patch/minor in `requirements.txt` + `constraints.txt`; install into the dev env

## 5. Verify

- [x] 5.1 Typecheck, lint, Jest (`--maxWorkers=2`)
- [x] 5.2 Backend pytest, ruff; `RUN_LIVE_TMDB=1 pytest -m live_tmdb`
- [x] 5.3 e2e touched: watchlist, detail-and-nav, import, write-feedback, library-filters (both projects); Python `test_watchlist.py`, `test_lists.py`, `test_profile.py`

## 6. Docs

- [x] 6.1 CLAUDE.md: region preference (`pickRegion`, never read `"US"` directly), Watchlist pagination mirrors Watched; `docs/BUG_BACKLOG.md` item 40 → 📝
