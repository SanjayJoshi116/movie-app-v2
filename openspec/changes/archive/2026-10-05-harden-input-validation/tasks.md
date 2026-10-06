## 1. Shared serializer building blocks

- [x] 1.1 In `backend/userdata/serializers.py`, add `INT32_MAX = 2_147_483_647` and `FiniteFloatField(FloatField)`, which rejects non-finite values with "Must be a finite number." (D1)
- [x] 1.2 Add `MediaIdentityMixin`. It declares `mediaId` (`IntegerField`, `min_value=1`, `max_value=INT32_MAX`) and `mediaType` (`ChoiceField(choices=MEDIA_TYPES)`, imported from `models.py`). Its `validate()` rejects a changed `media_id`/`media_type` when `self.instance` is set, and allows the same value (D2, D3)
- [x] 1.3 Apply the mixin to `WatchlistEntrySerializer`, `WatchedEntrySerializer`, `RatingEntrySerializer` and `UserListItemSerializer`, removing their local `mediaId`/`mediaType` declarations
- [x] 1.4 Switch every `voteAverage` and `userRating` to `FiniteFloatField`. Add the half-step validator to `userRating`, keeping `0.5..10` (D9)
- [x] 1.5 Add `max_length` to the hand-declared `CharField`s: `posterPath` 500 (×3 serializers), `originalLanguage` 10, `platform` 100. Bound `releaseYear` to `1800..3000` and `runtimeMinutes` to `0..INT32_MAX`

## 2. Ad-hoc endpoint input serializers (D4)

- [x] 2.1 Add the type/shape-only input serializers from the D4 table to `serializers.py`: login, delete account, password-reset request, password-reset confirm, TMDB create session, follow, episode progress. Passwords use `trim_whitespace=False`
- [x] 2.2 `auth_views.login` and `delete_account`: validate through their serializers. Keep the existing `401` "Invalid credentials." and `400` "Incorrect password." responses for empty or wrong values
- [x] 2.3 `password_reset_request` / `password_reset_confirm`: validate through their serializers. Keep the existing "Email is required." / "uid, token, and new_password are required." / "Invalid reset link." messages and the no-account-enumeration response
- [x] 2.4 `tmdb_views.tmdb_create_session`: validate `request_token` through its serializer, keeping the existing "request_token is required." response
- [x] 2.5 `social_views.followed_people_list` POST: validate through the follow serializer, keeping "personId is required." for a missing/null id
- [x] 2.6 `social_views.episode_progress` POST/PATCH: validate `season`/`episode` through the serializer. Return `400` when the `show_id` path value is outside `1..INT32_MAX` before writing (D5)

## 3. Bulk watched (D6)

- [x] 3.1 Add `BulkWatchedEntrySerializer` (`mediaId` bounds, `title` max 500 default `""`, `posterPath` max 500 nullable, `voteAverage` `FiniteFloatField(allow_null=True, required=False)`) and a top-level serializer (`entries` list capped at `MAX_BULK_ENTRIES`, `mediaType` `ChoiceField` default `"movie"`)
- [x] 3.2 Rewrite the entry loop in `watched_views.bulk_watched`: non-dict → error at that index; absent/`None`/`""` `mediaId` → skip; otherwise validate. Return `400 {"entries": {"<i>": errors}}` before any DB access if anything failed. Map a `null` `voteAverage` to `0`
- [x] 3.3 De-duplicate on the validated int `media_id`, so `5` and `"5"` count once. Leave the pre-check placement and `bulk_create` signal behavior unchanged (owned by `fix-backup-roundtrip`)

## 4. Avatar and profile

- [x] 4.1 `auth_views.avatar`: catch `(UnidentifiedImageError, OSError, SyntaxError, ValueError, Image.DecompressionBombError)`, with a comment on why each non-obvious one is there. After `Image.open`, reject when `img.width * img.height > Image.MAX_IMAGE_PIXELS`. Both paths return `400` "File is not a valid image." (D7)
- [x] 4.2 Feed a handful of corrupt inputs through the avatar endpoint in a scratch `verify_*.py`: truncated PNG, truncated JPEG, PNG with a corrupted IHDR/CRC, a 30000×30000 header-only PNG bomb, and a ~1.5× `MAX_IMAGE_PIXELS` image. Extend the exception tuple if any of them still 500s, then delete the script
  - Done as permanent cases in `test_input_validation.py` (`test_corrupt_images_rejected`) instead of a scratch script. It surfaced `IndexError` from PNG `verify()` on a file with no `IDAT` chunk, which is now in the tuple
- [x] 4.3 `UserProfileUpdateSerializer`: add `UnicodeUsernameValidator()` to `username` and `max_length=254` to `email` (D8)
- [x] 4.4 `auth_views.profile`: wrap `user.save()` in `transaction.atomic()`, and turn an `IntegrityError` into `400 {"username": ["This username is already taken."]}`

## 5. Tests

- [x] 5.1 New `backend/userdata/tests/test_input_validation.py` covering each spec scenario:
  - NaN/Infinity `voteAverage` on watchlist/watched/list items. Assert `400`, no row created, and the follow-up GET returns `200`
  - `"Infinity"` and `7.3` `userRating` → `400`; `7` and `7.5` → saved
  - over-long `posterPath`/`platform`/profile `email` → `400`
  - `mediaId`/`personId` `3000000000` → `400`; negative `runtimeMinutes` → `400`; `mediaType: "book"` → `400`
  - episode progress with show id `3000000000` → `400`. A GET/DELETE with an out-of-range path id → no `500` (pins D5's assumption)
  - JSON array body to each ad-hoc endpoint → `400`; non-string password-reset fields → `400`
  - watchlist/rating PATCH with a different `mediaId` → `400`, and both records unchanged; PATCH with the same identity plus a new title → `200`
- [x] 5.2 Bulk watched tests: a malformed entry at index 1 → `400` naming index 1 and zero rows written; a non-object entry → `400`; `voteAverage: null` saved as `0`; `5`/`"5"` → `added: 1, skipped: 0`; missing `mediaId` still skipped
- [x] 5.3 Avatar tests: a header-only bomb PNG and a warning-band image → `400` "File is not a valid image.", with the existing avatar unchanged
- [x] 5.4 Profile tests: `bad name!` → `400`. Simulate the rename race by patching the serializer's uniqueness pre-check to pass, so `save()` hits the DB constraint, and assert `400` "This username is already taken."
- [x] 5.5 Run the full backend suite with the Anaconda interpreter (`G:/Anaconda/envs/django/python.exe -m pytest` from `backend/`) and confirm existing tests pass unchanged. Run `npx tsc --noEmit` as a sanity check (no frontend changes expected)

## 6. Data check and docs

- [x] 6.1 Run the design's one-off NaN query against the local DB. Record the counts here, and fix any hits by hand
  - 2026-10-05: 0 NaN rows (WatchlistEntry 0/61, WatchedEntry 0/2192, UserListItem 0/25, RatingEntry 0/5). Nothing to fix
- [x] 6.2 Add a `docs/ARCHITECTURE.md` bullet: hand-declared camelCase serializer fields must restate the model's bounds, and float inputs use `FiniteFloatField`. Add a matching one-line convention to `CLAUDE.md` "Conventions to reuse"
- [x] 6.3 Update `docs/BUG_BACKLOG.md`: mark row 1 as proposed now, and done when archived. Note under item 2 that the mixed int/str id miscount was folded into this change
