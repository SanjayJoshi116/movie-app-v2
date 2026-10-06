## Why

Many write endpoints trust their input. The worst case: a client sends `"voteAverage": "NaN"`, DRF's `FloatField` accepts it (`min_value`/`max_value` comparisons with NaN are always false), and Postgres stores it. From then on, every GET of that account's watchlist, watched, ratings, lists or stats returns `500`, because the strict JSON renderer refuses to serialize NaN. The account stays broken until someone edits the DB by hand. Other inputs cause one-off `500`s: values longer than the column, integers past Postgres `integer` range, non-object JSON bodies, non-string fields, and decompression-bomb images. This is item 1 of `docs/BUG_BACKLOG.md`, next in the suggested order now that `fix-session-followups` has shipped in 0.16.0.

## What Changes

One rule across the backend API: **malformed input gets a `400` with a field-level message. It never gets a `500`, and it never stores a value that breaks later reads.**

- **Non-finite numbers:** `NaN`/`Infinity`/`-Infinity` are rejected for every float input (`voteAverage` on watchlist, watched, list items and bulk watched; `userRating`).
- **String lengths:** every string input is limited to its column length (`posterPath` 500, `platform` 100, `originalLanguage` 10, followed-person `name`/`profilePath` 500, profile `email` 254), so over-long values get a `400` instead of a DB `DataError`.
- **Integer ranges:**
  - media/person/show ids must be positive and fit Postgres `integer`. This covers `mediaId`, `personId`, and the `show_id` path segment on writes.
  - `releaseYear` gets a plausible range.
  - `runtimeMinutes` must be non-negative and bounded.
  - episode-progress `season`/`episode` must fit the column.
- **Media type:** `mediaType` accepts only `movie` or `tv` on every endpoint, matching the model choices.
- **Immutable identity on PATCH:** watchlist and rating PATCH can no longer change `mediaId`/`mediaType`. Trying to change either gets a `400`, which also removes the `unique_together` IntegrityError path. No frontend code PATCHes these fields today.
- **Request body shape:** endpoints that read fields directly from the body (bulk watched, follow, episode progress, login, delete account, password reset request/confirm, TMDB session creation) return `400` for a JSON array body, non-object entries, or non-string/non-integer field values, instead of crashing.
- **Bulk watched entries:** each entry is validated like a single watched POST. Entries without a `mediaId` are still skipped, as today. A `null` `voteAverage` (what the CSV import sends for an unparseable score) is treated as `0`. Ids are normalized to integers before de-duplication.
- **Avatar:** an image whose pixel count is above the decoder's safety limit gets a `400` ("File is not a valid image.") instead of a `500`. This covers both the hard `DecompressionBombError` and the warning band below it. Other decoder failures on malformed headers get the same `400`.
- **Profile username:** must pass the same character rules as registration. Two concurrent renames to the same name return `400` "This username is already taken." instead of an IntegrityError `500`.
- **Ratings:** `userRating` must be a multiple of 0.5 (TMDB silently rejects anything else). The UI only sends whole stars, so this changes nothing for real users.

Not changed here: the bulk-import transaction/pre-check race, post-save signals and list-import crashes (`fix-backup-roundtrip`), and ordering/correctness issues (`fix-data-correctness`).

## Capabilities

### New Capabilities
- `input-validation`: the backend-wide contract that malformed request input is rejected with a `400` and can never be stored in a form that breaks later reads. Covers numeric finiteness and ranges, string lengths, enumerated values, body shape, immutable record identity, and bulk-entry validation.

### Modified Capabilities
- `avatar-upload`: "Only JPEG, PNG, and WebP avatars are accepted" also rejects, with a `400`, images whose dimensions exceed the decoder's safety limit, and files the decoder fails on in any way.

## Impact

- **Backend code:**
  - `backend/userdata/serializers.py`: field bounds, a finite-float field, validators, immutable identity on update, username validator, and new small input serializers for the ad-hoc endpoints.
  - `watched_views.py` (bulk), `social_views.py` (follow, episode progress), `auth_views.py` (login, delete account, password reset ×2, profile IntegrityError, avatar decode errors), `tmdb_views.py` (create session).
- **API:** inputs that used to cause a `500` (or silently stored bad data) now get a `400`. Well-formed requests from the current frontend behave exactly as before. Response shapes don't change. Watchlist/rating PATCH requests that change `mediaId`/`mediaType` are now rejected; no client sends these.
- **Data:** no migration. Rows that already contain NaN aren't repaired by this change. The design covers a one-off check.
- **Tests:** new backend tests per endpoint for each rejection class. Existing tests should pass unchanged.
- **Frontend:** no changes.
