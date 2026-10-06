## Context

The backend has two kinds of write endpoints:

1. **Model-serializer endpoints:** watchlist, watched, ratings, list items, lists, profile. Their camelCase fields are hand-declared in `serializers.py` (`mediaId = IntegerField(source="media_id")`, etc.). Hand-declaring a field throws away everything DRF would have derived from the model: `max_length`, `choices`, and integer bounds. That's where the length, enum and range gaps come from. `FloatField` also accepts `"NaN"`/`"Infinity"`: `float()` parses them, and `min_value`/`max_value` comparisons with NaN are always false.
2. **Ad-hoc endpoints:** bulk watched, follow, episode progress, login, delete account, password reset ×2, TMDB create-session. These read `request.data.get(...)` directly. A JSON array body makes `request.data` a `list` (`AttributeError`), and a non-string value hits `.strip()`/`.encode()`/`.split()` (`AttributeError`). Unchecked ints reach the ORM as a `ValueError` or a Postgres `DataError`.

Facts checked on 2026-10-05:
- Env versions: DRF 3.16.1, Django 5.2.17, Pillow 12.1.1. `FloatField(min_value=0, max_value=10).run_validation("NaN")` returns `nan`.
- Settings: no `ATOMIC_REQUESTS`; DRF's default `STRICT_JSON=True` is why a stored NaN 500s every later GET.
- Frontend: no code PATCHes watchlist/rating entries (only `/auth/profile/` and `/lists/<id>/`). `StarRating` uses whole stars (`Rate count={10}`, no `allowHalf`). `bulkMarkWatched` callers can send `voteAverage: null`, from `parseFloat` giving NaN, which JSON turns into `null`. `getApiError` already reads field-keyed DRF errors (first field's first message), so `400`s with field errors show up properly in the UI.

## Goals / Non-Goals

**Goals:**
- Every malformed input class in backlog item 1 gets a `400` with a field-level message, and writes nothing.
- No change in behavior for any request the current frontend sends.
- One reusable place for each rule (finite floats, id bounds, media type, immutable identity), so new endpoints get it by default.

**Non-Goals:**
- Repairing rows that already contain NaN (see Migration Plan for a one-off check).
- Bulk-import transaction semantics, `post_save` signals, list-import crashes: `fix-backup-roundtrip`.
- Email-uniqueness races. There's no DB constraint on `User.email`; that's a schema change outside this backlog item.
- Changing response shapes for valid requests, or any frontend code.

## Decisions

### D1. A `FiniteFloatField` used for every float input
A `FloatField` subclass in `serializers.py` whose `to_internal_value` calls `super()` and then raises `ValidationError("Must be a finite number.")` if `not math.isfinite(value)`. Every float input uses it: `voteAverage` on the four media serializers, `userRating`, and bulk-watched entries.
- *Alternative:* per-field `validate_<name>` methods. Rejected: easy to forget on the next serializer, and it's exactly the "hand-declared field drops a rule" failure we're fixing.
- *Alternative:* a DB `CHECK` constraint. Rejected for now: needs a migration, and the API layer is the only writer.

### D2. Shared field factories and a media-identity mixin
- `INT32_MAX = 2_147_483_647` constant.
- `mediaId` → `IntegerField(source="media_id", min_value=1, max_value=INT32_MAX)`.
- `mediaType` → `ChoiceField(source="media_type", choices=MEDIA_TYPES)`, reusing the model's list, so there's one source of truth.
- Hand-declared `CharField`s get the column's `max_length`: `posterPath` 500, `originalLanguage` 10, `platform` 100.
- Watched fields:
  - `releaseYear`: `1800..3000`. Generous: it just has to be plausible and fit the column.
  - `runtimeMinutes`: `0..INT32_MAX`.
- These four media serializers share a `MediaIdentityMixin` that declares `mediaId`/`mediaType` and implements D3.
- Profile `email` gets `max_length=254` to match `User.email`.

### D3. Immutable identity on update: reject, don't silently ignore
In the mixin's `validate()`: when `self.instance` is set and the incoming `media_id` or `media_type` differs from the instance, raise a field error ("Can't be changed."). Resending the same value is fine.
- *Alternative:* make the fields `read_only` on update. Rejected: DRF would silently drop the value, so a client that thinks it moved a rating gets `200` and nothing changes. A `400` is honest.
- This removes the `unique_together` IntegrityError path entirely, with no try/except needed.

### D4. Small input serializers for ad-hoc endpoints: type and shape only
Each ad-hoc endpoint validates its body through a small `serializers.Serializer`. DRF's `Serializer.to_internal_value` already returns `400` "Invalid data. Expected a dictionary, but got list." for a non-object body, so that class of `500` goes away for free. **These serializers check type and shape only.** Fields that are optional today stay `required=False, allow_blank=True` with the old defaults, and the view keeps its existing business checks and messages. Examples: login still returns `401` "Invalid credentials." for an empty username; password reset still says "Email is required." / "uid, token, and new_password are required."; follow still says "personId is required.". So no existing message or status changes for well-formed requests.

| Endpoint | Serializer fields |
|---|---|
| login | `username`, `password`: `CharField(required=False, allow_blank=True, trim_whitespace=False)`. Passwords must not be trimmed. |
| delete account | `password`: same as login |
| password-reset request | `email`: `CharField(required=False, allow_blank=True, max_length=254)` (view still `.strip()`s) |
| password-reset confirm | `uid`, `token`, `new_password`: `CharField(required=False, allow_blank=True)`; `new_password` with `trim_whitespace=False` |
| TMDB create session | `request_token`: `CharField(required=False, allow_blank=True, max_length=200)` |
| follow | `personId`: `IntegerField(required=False, allow_null=True, min_value=1, max_value=INT32_MAX)`; `name`: `CharField(max_length=500, allow_blank=True, default="")`; `profilePath`: `CharField(max_length=500, allow_null=True, allow_blank=True, required=False)` |
| episode progress (POST/PATCH) | `season`, `episode`: `IntegerField(min_value=1, max_value=INT32_MAX, default=1)` |

These live in `serializers.py` next to the others. Episode progress keeps its current messages by mapping errors to the existing `detail` text where reasonable. It's acceptable for the message to become DRF's field-keyed format; the frontend shows whichever comes first.

### D5. Path ids on writes
`episode_progress` POST/PATCH and `followed_people_list` POST insert the id, so an out-of-range value would be a `DataError` on insert. `episode_progress` checks `1 <= show_id <= INT32_MAX` before writing and returns `400` otherwise. Reads and deletes with out-of-range path ids are left alone: on Postgres an `int4 = int8` comparison just matches nothing, and Django 5's integer lookups do the same. A test pins this, so a future DB/Django change can't silently regress it.

### D6. Bulk watched: validate per entry, all-or-nothing, preserve the "no mediaId → skip" rule
1. Validate the top level with a serializer: `entries` is `ListField(max_length=MAX_BULK_ENTRIES)`; `mediaType` is `ChoiceField(MEDIA_TYPES, default="movie")`. Keep the existing "entries must be a list." / "must not exceed 500" messages if cheap; otherwise use DRF's.
2. For each entry:
   - not a `dict` → error at that index.
   - `mediaId` absent, `None` or `""` → skip, as today.
   - otherwise validate with `BulkWatchedEntrySerializer`. Fields: `mediaId` (D2 bounds); `title` (`max_length=500`, default `""`); `posterPath` (500, nullable); `voteAverage` (`FiniteFloatField(allow_null=True, required=False)`, with `None` → `0`).
3. Collect errors as `{"entries": {"<index>": <errors>}}`. If any, return `400` before touching the DB.
4. De-duplicate on the validated **int** `media_id`. This fixes the mixed `5`/`"5"` miscount as a side effect. `fix-backup-roundtrip` still owns moving the existing-ids pre-check inside the transaction and the missing `post_save`.
- *Alternative:* skip malformed entries and report them. Rejected for now: the frontend only sends well-formed entries (the CSV parser already filters `mediaId > 0`), so a malformed entry means a buggy or hostile client. All-or-nothing is simpler to reason about and test. `fix-backup-roundtrip` can revisit this if import UX needs partial success.

### D7. Avatar decode errors and pixel limit
Around `Image.open`/`verify()`, catch `(UnidentifiedImageError, OSError, SyntaxError, ValueError, Image.DecompressionBombError)`. Pillow raises `DecompressionBombError` (not an `OSError`) above 2× `MAX_IMAGE_PIXELS`. Some plugins raise `SyntaxError`/`ValueError` on malformed headers or chunks during `verify()`. After `Image.open`, also check `img.width * img.height > Image.MAX_IMAGE_PIXELS` explicitly and reject. That covers the warning band (1×–2×), where Pillow only emits a `DecompressionBombWarning` and would otherwise accept the file. All of these return the existing `400` "File is not a valid image.".
- *Alternative:* turn the warning into an error with `warnings.catch_warnings()`. Rejected: it mutates process-global warning filters, which isn't thread-safe under the threaded dev server. The explicit size check is thread-safe and clearer.
- This is a named exception list, not a bare `except Exception:`, per the project convention. A comment explains why `SyntaxError`/`ValueError` are there.

### D8. Profile username
- `username` field: add `validators=[UnicodeUsernameValidator()]`, same as `User.username`, and keep `max_length=150`.
- In the `profile` view, wrap `user.save()` in `transaction.atomic()` and catch `IntegrityError`. Return `400 {"username": ["This username is already taken."]}`. The serializer's pre-check stays for the common, non-racing case. `atomic()` gives the failed save its own savepoint, so the connection stays usable even if `ATOMIC_REQUESTS` is turned on later.

### D9. Ratings in half-point steps
`userRating` validator: `(value * 2).is_integer()`. Exact for multiples of 0.5, because those are exactly representable in binary floating point. Range stays `0.5..10`.

## Risks / Trade-offs

- **A third-party or scripted client that relied on lax input** (e.g. PATCHing `mediaId`, sending 7.3 ratings, or a bulk payload with junk entries) now gets `400`s. → Acceptable: the only client is this app's frontend, which sends none of these. The proposal calls this out under API impact.
- **Field-keyed error bodies instead of `{"detail": ...}`** on some new rejections. → `getApiError` already handles both. Existing `detail` messages for previously-handled cases are kept (D4).
- **`releaseYear` bounds could reject a genuine edge case.** → `1800..3000` is wider than any TMDB release year. The frontend currently doesn't send `releaseYear` on POST anyway (that's `fix-data-correctness`).
- **Pillow exception surface may include something not listed** (e.g. `struct.error` on some truncated file). → Tasks include feeding a handful of corrupt/truncated/bomb files through the endpoint, extending the tuple if one surfaces. A missed type is still a `500`, so it's worth a quick fuzz rather than assuming.
- **All-or-nothing bulk import** means one bad row blocks the batch. → Only reachable by a malformed client today; noted for `fix-backup-roundtrip`.

## Migration Plan

- No schema migration. Deploy is a normal backend restart. Rollback is reverting the commit; no data depends on the new rules.
- **One-off check for already-poisoned rows** (run manually with the Anaconda interpreter in `manage.py shell` before/after deploy; not shipped as code):
  ```python
  from django.db.models import Q
  from userdata.models import WatchlistEntry, WatchedEntry, UserListItem, RatingEntry
  nan = float("nan")
  for M, f in [(WatchlistEntry, "vote_average"), (WatchedEntry, "vote_average"),
               (UserListItem, "vote_average"), (RatingEntry, "user_rating")]:
      print(M.__name__, M.objects.filter(**{f: nan}).count())
  ```
  Postgres treats `'NaN' = 'NaN'` as true, unlike IEEE, so the equality filter finds them. Fix any hits by setting `vote_average=0` (and deleting or re-entering affected ratings). Document the result in the change's tasks when applying.

## Open Questions

None blocking. All-or-nothing vs partial bulk import (D6) is deliberately deferred to `fix-backup-roundtrip`.
