## Context

- Ratings are one row per title (`RatingEntry`, 0.5–10, `unique_together(user, media_id, media_type)`), written by `POST /api/ratings/` (upsert under `_rating_lock`, TMDB sync bounded in the request, recommendation refresh triggered on create). The frontend writes through `useRatings.set(id, type, title, score, review)` behind a per-title inflight slot; `remove(id, type)` deletes. Both are on the app context (`setRating`, `removeRating`, `getRating`, `reloadRatings`, `ratingsError`; `RatingsContext` carries the whole ratings hook).
- The watched history (`useWatched`, with `hasLoaded`/`isLoading`/`error`) and all ratings are already loaded app-wide after sign-in, so "watched and unrated" needs no new request.
- Recommendations already weigh ratings (`_compute_for_you` seeds from ≥7 and skips ≤4; `_compute_personalized` scales each title by rating/10, unrated 0.5, and drops ≤4). Nothing there changes.
- Throttles: rating writes use the default `user` bucket (5,000/day). A 300-title session is well inside it.

## Goals / Non-Goals

**Goals:**
- Rate a backlog fast: one tap per title, no dialog, no waiting on the network between titles.
- Never claim a rating that didn't save; a failure is visible and recoverable.
- Reuse the existing write path so TMDB sync, limits and refresh triggers stay correct.

**Non-Goals:**
- Half-point scores on this page (the detail page's stars still allow them).
- Reviews on this page.
- A persistent "never ask about this title" list (skip is per visit). Can come later if wanted.
- Any backend or recommendation-algorithm change; rating the watchlist or unwatched titles.

## Decisions

1. **Own route `/watched/rate`, lazy-loaded, not a dialog on Watched.** A page gets its own tab title, Back works, it can be linked from Recommendations, and keyboard shortcuts don't collide with Watched's search box. `navSection` adds `/watched` to its sections with sub-pages, so Watched stays highlighted.
   - Alternative: a modal on the Watched page. Rejected: shortcuts and focus trapping inside a modal over a filtered grid get messy, and Recommendations couldn't link to it.

2. **Queue computed in the browser by a pure `buildRatingQueue(watched, hasRating)`.** Watched entries without a rating, sorted by `watchedAt` descending, `id` as tiebreak. Labels through `mediaLabel(title, id)`; the watch day through `formatWatchedDate(watchedAt, watchedTz)`, per the local-dates rule.
   - Alternative: a backend `?unrated=1` endpoint. Rejected: both lists are already in memory, and a server list would go stale as the user rates.

3. **Page state on top of the derived list.** The page keeps three small pieces of state: `hidden` (keys saved or in flight on this visit, so they leave the queue at once), `skipped` (keys in skip order, moved to the end) and `front` (keys returned by a failed save or an undo, shown first). The visible queue = `front` ∪ base order, minus `hidden`, with `skipped` moved last. A title rated elsewhere drops out because the base list is rebuilt from the ratings. State is in memory only, so reopening restores the normal order (spec: skip is per visit).

4. **Optimistic advance, honest outcome.** A tap adds the key to `hidden` and calls `setRating(...)` without awaiting before showing the next title. On success it pushes onto the undo stack and bumps the "rated" count. On failure: `showError(getApiError(err, "Couldn't save the rating."))`, remove the key from `hidden`, put it in `front`. No success toast per title: the progress line is the feedback, and it counts only resolved saves. This keeps the "success only after `await`" rule while removing the network wait between titles.
   - Session guard: results that land after sign-out are dropped (`currentSessionGeneration` / `isCurrentSession`), as the hooks do; the hook already drops its own state update.

5. **Undo = delete the last rating saved here.** `removeRating(id, type)`; while it runs the Undo button is busy; on success the key leaves `hidden`/the stack and goes to `front`; on failure an error shows and the stack is kept. Undo of a title whose save is still pending waits on the same inflight slot (the hook queues a different action on that key behind the pending one), so order is kept.

6. **Scores 1–10 as buttons, not stars.** Ten antd `Button`s in a wrapping row (two rows of five under ~400 px, CSS only, no JS width checks), each `aria-label="Rate <title> <n> out of 10"`. Colors from theme tokens; `FONT_SIZE` constants. Keyboard: a `keydown` listener on `window` while the page is mounted, ignored when the event target is an input/textarea/contenteditable or a modifier is held; `1`–`9`, `0` → 10, `s` skip, `u` undo.

7. **Loading and errors.** Skeleton until the watched history and the ratings have loaded (`useRatings` gains `hasLoaded` like `useWatched`, read through `RatingsContext`, which already carries the whole hook); `LoadError` with Retry (reloads whichever failed) if either failed and never loaded. A ratings reload failure that keeps data keeps the queue.

8. **Entry points.** A small antd `Alert` (info) above the Watched grid: "N watched titles aren't rated" + a `Link` "Rate them" (shown when N ≥ 1, after both loads). Recommendations: one line under the page intro when N ≥ 3. Both read the same count helper (`countUnrated`), so they can't disagree with the page.

## Risks / Trade-offs

- **Many parallel POSTs when tapping fast** → each takes its own title lock and bounded TMDB sync; recommendation refreshes coalesce per user (one running + one follow-up). Acceptable; if it ever matters, a small client-side concurrency cap (e.g. 3 in flight) is easy to add in the page.
- **A failed save reappears out of order** (at the front) → intended, so the user sees it right away.
- **No half points** → a user who wants 7.5 uses the detail page; noted in the page's help text.
- **Large histories** (20,000 watched) → the queue is a filter + sort over in-memory arrays, once per change; fine.
