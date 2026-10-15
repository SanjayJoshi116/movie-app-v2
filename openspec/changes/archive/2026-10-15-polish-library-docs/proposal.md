## Why

Backlog item 40, the last of the sixth audit. Smaller gaps in the library, imports, region handling and docs:

- **Watchlist has no pagination.** Every entry renders as an animated card at once; Watched pages at 48.
- **Region is always US.** Where to Watch, the certification and the Mark as Watched platform list read only TMDB's `US` data (honestly labelled), so users elsewhere see providers they can't use. There is no setting.
- **The For You tooltip claims "patterns from similar viewers".** No other users' data is used; personalized sections cluster the user's own genres.
- **The Watched page's CSV export drops runtime, platform and poster,** and its importer reads neither back, so the page's own export → import loses them (the backup ZIP keeps them).
- **CSV imports ignore a file-read failure:** an unreadable file shows nothing.
- **A backup restore loses an empty list silently:** a failed create adds the list's 0 entries to "failed", so the result reads as success.
- **A missing list shows a plain empty state,** not the not-found page detail and person pages use.
- **README says "43 REST API endpoints";** the code and its own table have 44.
- **Dependencies:** Pillow, requests and psycopg2-binary have patch/minor releases out. (Django 6.1, DRF 3.18, gunicorn 26 are majors and stay out of this change.)

## What Changes

- Watchlist paginates like Watched (page and page size in the URL, clamped to a non-empty page).
- A region preference: defaults to the device's locale region, changeable in Edit Profile, kept per device like the theme. Where to Watch, the certification and the Mark as Watched platforms use it; when TMDB has nothing for that region, they fall back to the US and say so.
- The For You tooltip describes what the sections are actually built from.
- The Watched CSV export carries runtime, platform and poster; the Watched CSV import reads them back.
- CSV imports report a file that can't be read.
- A backup restore reports a list it couldn't create, empty or not.
- A missing list shows the not-found state.
- README endpoint count fixed.
- Pillow, requests and psycopg2-binary bumped to their latest patch/minor versions, constraints regenerated.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `title-details`: Where to Watch (and the certification) use the user's region, with a labelled US fallback.
- `mark-watched`: the platform list follows the region.
- `library-filters`: the Watchlist paginates and stays on a non-empty page.
- `data-backup`: Watched CSV round trip keeps runtime/platform/poster; unreadable files are reported; a list that couldn't be created counts as a failure.
- `load-states`: a missing list shows the not-found state.

## Impact

- Frontend: `UIContext` (region), new `src/utils/region.ts`, `ProfileModal.tsx` (region select), `WatchProviders.tsx`, `MovieDetails.tsx`, `MarkWatchedModal.tsx`, `WatchlistPage.tsx`, `WatchedPage.tsx`, `CSVUploadModal.tsx`, `CSVListImportModal.tsx`, `CSVImportAllModal.tsx`, `ListDetailPage.tsx`, `RecommendationsPage.tsx`, `csvParse.ts` if the import needs the new columns.
- Backend: `requirements.txt`, `constraints.txt` only.
- Docs: README (count, features), CLAUDE.md (region), BUG_BACKLOG.
- Provider deep links (`PROVIDER_SEARCH_URLS`) stay on the services' global sites, which redirect by country.
