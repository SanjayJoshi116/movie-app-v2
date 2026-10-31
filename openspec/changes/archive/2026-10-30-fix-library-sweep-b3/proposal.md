## Why

The B3 module sweep (`/code-review high` of the library CRUD views, backlog item 53) found ten problems, all checked against the code: two concurrent rating writes can leave TMDB with a different score from the app; single-item adds fail when TMDB leaves out a poster or score; a user's library has no size limit and `GET /lists/` returns every item at once; a rating POST without `review` erases the review; single and bulk writes store reviews differently; clearing the watched history works row by row; import counts don't add up; bulk accepts blank titles; an account deleted mid-import gives a 500; and `views.py` is a leftover re-export layer. The `/security-review` of the same files found nothing at the exploitability bar.

## What Changes

- Rating writes for one title are serialized per user and title (create, score edit, delete, through the TMDB sync), so the score compare reads the latest value and TMDB ends with the score the app stores.
- A rating POST that leaves out `review` keeps the stored review (a new rating still starts with an empty one).
- Reviews are trimmed the same way on single and bulk writes.
- Single-item watchlist, watched and list-item adds accept a missing `posterPath` (stored null) or `voteAverage` (stored 0), as bulk already does.
- **New limits per user**: 20,000 watched, 20,000 watchlist, 20,000 ratings, 200 lists, 2,000 items per list. A single add past a limit is a 400 with a message naming it. A bulk import inserts what fits and reports the rest as over the limit; the import dialogs show that count.
- Bulk responses account for every entry sent: in-request duplicates count as skipped, and entries without an id are reported in a new `ignored` count, so `added + skipped + ignored + overLimit` equals the entries sent.
- A title stored blank (only bulk imports can do that) is shown as "Untitled (#id)" on cards and in button labels, through one shared helper.
- Bulk imports whose account was deleted while they ran answer 401 instead of a 500.
- Clearing the watched history deletes in one statement and schedules one recommendation refresh.
- `urls.py` and the tests import views from their domain modules; `views.py` and the test-only re-export of `MAX_BULK_ENTRIES` in `watched_views.py` go.

## Capabilities

### New Capabilities
- `library-limits`: per-user caps on library size, how single and bulk writes behave at a cap, and how the limit is reported.

### Modified Capabilities
- `ratings`: concurrent writes to one rating stay consistent with TMDB; an omitted review is kept; reviews are trimmed on every write path.
- `input-validation`: single-item adds accept a missing poster or score.
- `data-backup`: import counts add up to the entries sent (ignored and over-limit counts); blank imported titles get a fallback label; an import whose account is deleted ends cleanly.

## Impact

- Backend: `ratings_views.py`, `watchlist_views.py`, `watched_views.py`, `lists_views.py`, `bulk_import.py`, `serializers.py`, `urls.py`, `views.py` (removed), a new limits module; tests under `backend/userdata/tests/` that import from `views`. No migration.
- Frontend: `userApi.ts` `bulkImport` sums the new counts; the three import dialogs and the backup restore report them; a `mediaLabel(title, id)` helper used by `LibraryItemCard`, `MediaCard` and the other places that show a stored title; `domain.ts` DTO for the bulk response.
- API: bulk responses gain `ignored` and `overLimit`; single adds can answer 400 at a limit. Additive.
