## 1. Data and helpers

- [x] 1.1 `useRatings`: add `hasLoaded` (a successful load this session, kept across a failed reload, like `useWatched`), exposed through `RatingsContext` (which already carries the whole hook; the app context needs no change)
- [x] 1.2 `src/utils/ratingQueue.ts`: pure `buildRatingQueue(watched, hasRating)` (unrated watched entries, `watchedAt` desc, `id` tiebreak) and `countUnrated(watched, hasRating)`; Jest tests (order, rated excluded, movie and TV with the same id kept apart, empty)
- [x] 1.3 `navSection`: add `/watched` to the sections with sub-pages; extend `navSection.test.ts` (`/watched/rate` → `/watched`, `/watched` itself unchanged)

## 2. Rate page

- [x] 2.1 `src/pages/RateQueuePage.tsx`, lazy route `/watched/rate` in `App.tsx` (protected, own `ErrorBoundary` like the other routes), `usePageTitle("Rate Watched Titles", { loading })`
- [x] 2.2 Loading skeleton until watched and ratings have both loaded; `LoadError` with Retry (reloads whichever failed) when either never loaded; "All caught up" state with a link to Watched
- [x] 2.3 Current-title card: poster through `POSTER_URL` or `PosterPlaceholder`, `mediaLabel` title, year when known, watch day via `formatWatchedDate(watchedAt, watchedTz)`; progress line "N rated · M left"
- [x] 2.4 Ten score buttons (1–10, `aria-label` "Rate <title> <n> out of 10"), wrapping by CSS only, theme tokens and `FONT_SIZE`; Skip button; Undo button shown only when this visit has a saved rating
- [x] 2.5 Queue state (`hidden`, `skipped`, `front`, undo stack) per design decision 3; optimistic advance on tap, `setRating(id, type, mediaLabel(title, id), score)`; success → undo stack + rated count; failure → `showError(getApiError(...))`, title back to front; results after sign-out dropped via the session generation
- [x] 2.6 Undo: `removeRating` of the last saved title, busy while running, title back to front on success, error and stack kept on failure
- [x] 2.7 Keyboard: `1`–`9`, `0` = 10, `S`, `U` on `window` while mounted; ignored in text fields and with modifier keys
- [x] 2.8 Jest page tests: queue order and labels, tap saves and advances, failed save returns the title and isn't counted, skip order, undo (and none offered before a rating), keys incl. ignored in an input, loading/error/all-caught-up states, a title rated elsewhere leaves the queue

## 3. Entry points

- [x] 3.1 Watched page: info `Alert` "N watched titles aren't rated" + "Rate them" `Link` when N ≥ 1 and both loads done; Jest test incl. hidden when all rated
- [x] 3.2 Recommendations page: one-line prompt with the same link when N ≥ 3; Jest test

## 4. E2E and docs

- [x] 4.1 TS e2e `e2e/rating-queue.spec.ts` (mocked API): open from Watched's prompt, rate two by click and key, skip, undo, end state; assert the `POST`/`DELETE` bodies; Watched highlighted in the nav
- [x] 4.2 Run checks: `npm run typecheck`, `npm run lint`, Jest, the new spec plus `library-filters`/`responsive` e2e if touched
- [x] 4.3 Docs: README (tree + features), `features.txt`, `ideas.md` item 2 marked done, CHANGELOG `[Unreleased]`; CLAUDE.md only for a new convention (e.g. `useRatings.hasLoaded`)
