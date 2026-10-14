## Why

The review of 0.24.0 (backlog item 31) found that the new paced imports and episode-progress guards have holes. A slow import keeps writing after its dialog closes, and after a sign-out it can write one account's backup into the next account. Remove can report success for a Next Episode click. A 429 slows only one of the four lookup workers. A non-ISO watched date fails a whole 500-row chunk. These are next in the suggested order because one of them writes into the wrong account.

## What Changes

- **Imports belong to the session that started them.** Each import (backup restore, watched/watchlist CSV, list CSV) records the session when the user submits. It stops before its next write once that session has ended, and reports that it stopped. Nothing from it reaches the next account.
- **An import's dialog can't be closed while it runs.** Cancel, ×, Escape and an outside click are disabled until it finishes, so a second run can't start alongside the first (which created every list twice).
- **Episode progress runs one write at a time per show, in click order.** Repeating the same action still settles with the first request. A different action (Remove while Next Episode is saving) waits for the first to finish and then runs, so its own result is what's reported. Writes also drop their result after sign-out, like the other library hooks.
- **A 429 pauses the whole lookup schedule**, not just the worker that got it, so the other workers don't spend their tries in the same window.
- **CSV watched times must be ISO 8601 date-times with an offset.** Other readable formats (`05/01/2024`, `May 1, 2024`) are dropped for that row only, which then gets the import time, instead of failing the whole chunk on the server. A date-only value (`2024-05-01`) is kept as noon UTC on that date, so it shows on that day in nearly every time zone.
- **Follow-triggered notification refreshes can't apply out of order, and are coalesced.** A refresh's response applies only if no newer refresh started after it. Follow changes within a short window cause one refresh, so following many people quickly no longer hits the notifications rate limit.
- **Restoring follows refreshes notifications**, like following someone by hand.
- **Opening Profile no longer fetches followed people.** The import dialog reads the followed-people context without starting its lazy load.
- **A followed person with a blank name is shown as "Person <id>"** on cards and in notifications, instead of an empty name.
- **The filter drawer seeds only genres valid for the current media type**, so a remount on a scope change can't carry the previous scope's genres into the draft.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `data-backup`: imports stop after sign-out and can't be closed while running; a 429 pauses all lookups; CSV watched times must be ISO date-times, with date-only values kept on their day.
- `write-feedback`: a different write for the same item waits for the in-flight one and reports its own outcome (repeats still settle with the first).
- `auth-session`: an import, and an episode-progress write, never write or show results after the session that started them ended.
- `notifications`: follow-triggered refreshes apply in order and are coalesced; restored follows refresh notifications; blank names show a fallback.
- `browse-filters`: the filter drawer's draft genres are always valid for the current media type.

## Impact

- Frontend:
  - Import dialogs: `src/components/lists/CSVImportAllModal.tsx`, `src/components/CSVUploadModal.tsx`, `src/components/lists/CSVListImportModal.tsx`
  - Lookups and parsing: `src/utils/pacedLookup.ts`, `src/utils/csvParse.ts`
  - Hooks and context: `src/hooks/useEpisodeProgress.ts`, `src/hooks/useNotifications.ts`, `src/context/FollowedPeopleContext.tsx` (a reload that counts as a follow change)
  - Display and filters: `PersonCard.tsx` and the notification list (name fallback), `src/components/layout/FilterPanel.tsx`
- Tests: Jest for each hook/util; the touched e2e specs only (imports, episode progress, notifications, filter panel).
- Backend: one line in `notifications_views.py`. A notification item has no person id for the client to fall back on, so the server sends `personName` as "Person <id>" when the stored name is blank. The server keeps accepting a blank name on follow and restore. No other backend or API change.
- Docs: `docs/BUG_BACKLOG.md` status, CHANGELOG, and CLAUDE.md where a convention changes (an import is a long-running write bound to its session).
