## Context

See proposal.md for why. Today:

- `WatchProviders.tsx`, `MovieDetails.tsx` (`renderCertifications`) and `MarkWatchedModal.tsx` each read the `"US"` key of TMDB's `watch/providers.results` / `release_dates.results`. TV detail has no certification.
- `UIContext` holds the theme through `useLocalStorage("cinedb_theme", …)`; theme is a device preference kept across sign-out, unlike the browse state reset there.
- `WatchedPage.tsx` paginates with `parseIntParam` for `?page` / `?pageSize`, clamps to the last non-empty page once loaded, and slices `filtered`. `WatchlistPage.tsx` renders `filtered` whole.
- `WatchedPage.handleExport` writes `title,type,tmdb_id,vote_average,watched_at,watched_tz`; `CSVUploadModal` imports through `parseCSVForImport` and sends `watchedAt`/`watchedTz` when present.
- `CSVUploadModal` and `CSVListImportModal` use `FileReader` with `onload` only.
- `CSVImportAllModal.importLists` adds `list.entries.length` to `failed` when `createList` fails.
- `ListDetailPage` shows `Empty "List not found."` with a Back button when the list isn't in the loaded lists (and `LoadError` when the load failed).
- `backend/requirements.txt` pins `Pillow==12.1.1`, `requests==2.33.0`, `psycopg2-binary==2.9.9`; `constraints.txt` already has `urllib3==2.8.0`.

## Goals / Non-Goals

**Goals:** close item 40; region handled consistently in one place.

**Non-Goals:** region-specific release dates on browse/Calendar (TMDB's `region` param), per-country provider deep links, server-side storage of the region, major dependency upgrades.

## Decisions

**1. Region helpers in one module, preference in `UIContext`.**
`src/utils/region.ts`: `deviceRegion()` (`new Intl.Locale(navigator.language).maximize().region`, falling back to `"US"`; so `en-IN` → IN, `hi` → IN, bare `en` → US), `regionName(code)` (`Intl.DisplayNames`, code on failure), and `pickRegion(byRegion, region)` returning `{ code, data, fallback }`: the user's region's entry if present, else the US entry with `fallback: true`, else `{ code: region, data: undefined }`. `UIContext` adds `region`/`setRegion` through `useLocalStorage("cinedb_region", deviceRegion())`; like the theme, it isn't reset on sign-out. All three readers go through `pickRegion`. *Alternative:* store it on the account (a migration and an API field for a device-ish preference).

**2. Region list from TMDB.**
Edit Profile's "Data & TMDB" tab gets a "Region" `Select` (searchable, saved on change like the theme; the tab is where the TMDB-related settings live), its options from TMDB `/watch/providers/regions` through the proxy (`fetchProviderRegions` via `sharedGet`; cached 6 h like other TMDB data). If the request fails, the select still shows the current region and a few common ones aren't invented: it shows just the current code with its `Intl` name. The new TMDB request gets a shape check in `test_tmdb_live.py`, as the live-checks rule requires.

**3. Labels name the shown region.**
Where to Watch's heading/notice and the certification tooltip use `regionName(code)`; with `fallback`, they say "Showing United States availability: nothing listed for <region>." (the certification gets a "(US)" suffix). The not-available message names the user's region.

**4. Watchlist pagination mirrors Watched.**
Same `PAGE_SIZES`, `parseIntParam` reads, clamp effect (only once loaded, not on error) and `Pagination` block; search/sort/type/watched-status changes reset to page 1; the scroll-restore-on-return stays. *Alternative:* extract a shared `usePagedList` hook (worth it at a third caller; two isn't enough to justify the churn here).

**5. Watched CSV round trip.**
Export adds `runtime_minutes`, `platform`, `poster_path` columns (after the existing ones, so older readers still work). `parseCSVForImport` reads them when present (runtime as a non-negative integer, platform trimmed, poster path kept only if it starts with `/`), and `CSVUploadModal` sends them, preferring a row's own poster over the lookup's.

**6. Read errors and failed lists.**
Both CSV modals set `reader.onerror` → their existing parse-error alert ("Couldn't read that file."). `importLists` adds a `failedLists` count and the result line says "N lists couldn't be created"; such a section counts as failed.

**7. Not-found list.**
`ListDetailPage` renders `<LoadError notFound title="List not found" />` plus its Back-to-My-Lists button when the lists loaded and the id isn't among them.

**8. Dependency bumps.**
Latest patch/minor of the three pins at implementation time (`pip index versions`), both `requirements.txt` and `constraints.txt`, installed into the dev env, full backend suite run.

## Risks / Trade-offs

- [`Intl.Locale.maximize` guesses a region for a bare language] → the user can change it; US remains the ultimate fallback.
- [Region names from TMDB vs `Intl` differ slightly] → the select uses TMDB's English names; labels elsewhere use `Intl` (consistent within a page).
- [Older Watched CSVs] → new columns are optional on import.
- [psycopg2 patch on Windows dev env] → install from the same wheel source; the suite runs against real Postgres.

## Migration Plan

Frontend and pins only; no migration. The region defaults from the device, so nothing changes for US users.
