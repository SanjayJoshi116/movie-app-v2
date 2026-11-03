## Why

Most watched titles never get a rating: marking a title watched doesn't ask for one, and rating later means opening each detail page. Ratings are what recommendations weigh most (rated ≥7 seeds "Because you watched", a rating scales a title's weight in the taste clusters, ≤4 is left out), and what Stats' rating charts read. A quick way to rate the backlog in one sitting makes all of that better at no TMDB cost. It is `ideas.md` item 2, the first feature after the review sweep.

## What Changes

- **New "Rate your watched titles" page** at `/watched/rate`: one watched-but-unrated title at a time (poster, title, year, watch date), ten buttons 1–10. A tap saves that score and shows the next title at once.
  - **Skip** moves a title to the end of the queue for this visit; nothing is stored.
  - **Undo** removes the last rating made on the page and puts that title back in front.
  - Keyboard: `1`–`9` and `0` (= 10) rate, `S` skips, `U` undoes; every control is also a labelled button.
  - Queue order: most recently watched first. Movies and TV together.
  - A progress line ("3 rated · 8 left"), and an "All caught up" end state with a link back to Watched.
- **Entry points**: the Watched page shows "N watched titles aren't rated · Rate them" when N > 0, and the Recommendations page shows a short "Rate what you've watched to improve these" prompt with the same link when N ≥ 3.
- **Saves go through the existing rating write** (`useRatings.set`, one `POST /api/ratings/` per tap), so TMDB sync, the rating lock, the recommendation refresh trigger and library limits all apply unchanged. A failed save shows its error and puts the title back at the front of the queue.
- **Navigation**: the page belongs to Watched (Watched stays highlighted).
- No backend change, no new endpoint, no migration: the queue is computed in the browser from the watched history and ratings the app already loads. Recommendation weighting already favours rated titles; this change doesn't touch it.

## Capabilities

### New Capabilities
- `rating-queue`: the quick-rate page, its queue rules (who is in it, order, skip, undo, failure), keyboard use and entry points.

### Modified Capabilities
- `routing`: "Navigation highlights the current section" gains the rate page as a Watched sub-page.

## Impact

- Frontend only: new `src/pages/RateQueuePage.tsx` (lazy route in `App.tsx`), a pure `buildRatingQueue()` util, entry banners in `WatchedPage.tsx` and `RecommendationsPage.tsx`, `/watched` added to `navSection`'s sections with sub-pages.
- Uses `useRatings.set`/`remove` through the app context; no change to the hooks' contracts.
- Tests: Jest for the queue util and page (tap, skip, undo, failure, keyboard, loading/error), routing nav test, one TS e2e spec.
- Docs: README tree and features, CLAUDE.md only if a new convention appears.
