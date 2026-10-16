## Why

Two `/code-review` passes over items 43 and 44 (backlog item 45) found edge cases those changes left behind. The worst ones break the rule items 43 and 44 were meant to enforce, that one bad cell never fails a whole 500-row import chunk:
- A title cut at 500 can split an emoji and leave half of it, which PostgreSQL refuses.
- Length checks count each emoji as 2 while the server counts 1, so valid reviews are dropped.
- A backup restore throws away the score it already looked up.

The Watchlist's new watched-history error screen also gives no feedback on Retry.

## What Changes

- **Character-based limits.** Import title shortening and every length check in the CSV readers (review, platform, time zone) count characters (code points) as the server does, and a shortened title never ends in half a character.
- **Backup restore keeps the looked-up score.** When a backup row is looked up for its missing poster and the backup's score is 0 (blank, bad or a real 0), the restore keeps the score TMDB returned. A row that has a poster is still never looked up for its score (item 44's decision holds).
- **One lookup per title.** Import lookups are made once per title (media type and id), however many rows or backup sections it appears in. The "saved without a poster" count counts titles, not rows.
- **Clock skew.** A backup's added, watched or rated time up to 5 minutes ahead of the device clock is kept, the same 5-minute leeway the server allows, instead of being replaced by the restore time.
- **Watchlist retry and clamp.**
  - While the watched history is reloading after a failed first load, the Watchlist shows its loading placeholder instead of the unchanged error screen.
  - The page clamp waits for any watched-history reload to finish.
- **Person page empty response.** When the person request succeeds but gives no person, the page is titled with the same error heading it shows ("Failed to load this person"). The movie and TV pages show and title their error state in the same case instead of rendering nothing.
- **Import dialogs after sign-out.** The Watched CSV import makes no dialog state change after the session ends, including right after the lookups.
- The lookup helper's contract is documented: an `undefined` score means "unknown, look it up", while `0` means "given".

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `data-backup`:
  - Lookups are made once per title, and the "saved without a poster" count counts titles.
  - A backup row looked up for its poster keeps the looked-up score when the backup's score is 0.
  - Text limits count characters, and shortening never splits a character.
  - Backup timestamps get a 5-minute future leeway.
- `load-states`: a Retry of a failed library-filter collection shows the loading state while it runs.
- `library-filters`: the Watchlist clamp waits for a watched-history reload in progress.
- `accessibility`: a detail or person page whose request succeeds without a record is titled and shown as failed.

## Impact

- Frontend only:
  - Import parsing and lookups: `src/utils/csvParse.ts`, `src/utils/importPosters.ts`
  - Import dialogs: `src/components/lists/CSVImportAllModal.tsx`, `src/components/CSVUploadModal.tsx`
  - Pages: `src/pages/WatchlistPage.tsx`, `src/pages/PersonPage.tsx`, `src/pages/MovieDetailPage.tsx`, `src/pages/TVDetailPage.tsx`
  - Their Jest tests, plus `e2e/import.spec.ts` if restore counts change.
- No backend, API, migration or dependency changes.
- Backlog item 45.
