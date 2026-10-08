## Context

See proposal.md for the findings. All of them were re-checked on 2026-10-08:
- 12 `count() > 0` guards
- 24 `wait_for_timeout` calls
- 5 bare-array mocks
- the mock fields vs. `serializers.py` (`ratedAt`, no `watched`, the full `WatchedEntrySerializer` field list, `UserSerializer`'s `is_staff`/`avatar_url`) and `stats_views.py` (`"%b %Y"`, `totalRuntimeMinutes`)

The two e2e suites have different costs. Python (pytest-playwright) takes ~12 min for 176 tests. TS Playwright takes ~2 min for 38 tests × 2 projects. Jest covers the hooks.

## Goals / Non-Goals

**Goals:**
- Every touched or new test is shown to fail when the behavior it covers is broken: one temporary break per test, then revert.
- The mocks can't silently drift from the serializers again.

**Non-Goals:**
- Fixing app bugs these tests expose, beyond trivial ones (see Risks).
- Converting the `onClick` cards or rewording the CardLink rule. That's item 13 and its open decision.
- Rewriting tests that are already honest just to change style.

## Decisions

**1. The mock-vs-serializer check is a backend pytest that reads the Python conftest with `ast`.**
- `backend/userdata/tests/test_e2e_mock_shapes.py` parses `e2e/python/conftest.py` and pulls out the `MOCK_*` dict literals with `ast.literal_eval`.
- It compares their key sets with the serializers' `fields`. For stats, it compares with the keys of a real `/api/stats/` response for a seeded user, and checks the month label against the same `strftime`.
- `ast` rather than `import`: the conftest imports playwright, which the backend CI job doesn't install, and the check shouldn't need a browser.
- *Rejected: moving the mocks into a shared JSON file.* It's a bigger refactor of every Python test's imports for the same guarantee.

**2. TS mocks are typed against the app's own types.**
- `MOCK_USER` in `e2e/fixtures.ts` becomes `satisfies AuthUser`, which is exported from `AuthContext.tsx` (currently module-private). Any TS record mocks use `satisfies` with the `*DTO` types in `src/types/domain.ts`.
- `e2e/tsconfig.json` already includes the app through `npm run typecheck`, so drift becomes a type error at no runtime cost.

**3. Python list mocks: `fulfill_json` rejects a bare list for list endpoints.**
- `fulfill_json(route, body)` raises when the route's URL matches one of the paginated endpoints (watchlist, watched, ratings, lists, followed-people) and `body` is a `list`. This mirrors what `paginated()` documents.
- A future bare `[]` then fails loudly at the first run, instead of passing on a shape production never sends.

**4. How sleeps are replaced:**
- **Debounced filter inputs:** `expect(locator).to_be_visible()` / `not_to_be_visible()` on the filtered result. Playwright's auto-retry covers the debounce.
- **Theme toggles:** `expect(page.locator("body")).to_have_class(re.compile("dark-theme"))` instead of reading the attribute after 300ms.
- **"0 items" / empty assertions:** first wait for the loading state to be gone (`.ant-skeleton` / `.ant-spin` count 0, per CLAUDE.md's SkeletonCard note), then assert.
- **`test_stats.py`'s delayed route:** the handler only stores the route, so the test can assert the loading state while the request is held. The test then fulfills every held route (dev StrictMode can fetch twice) and re-routes for late ones. A sleep inside the handler blocks Playwright's dispatch. (A `threading.Event` was the first plan, but sync Playwright only runs handlers inside its own calls, so the handler would deadlock waiting on the test.)
- **A `wait_for_timeout` that waits for "nothing happens"** (e.g. no request after an action): keep it only where no condition exists to wait on. It must sit after a positive anchor, with a comment saying why.

**5. Where the new scenario tests go:**

| Scenario group | Suite | Why |
|---|---|---|
| login-page (429, trim, autofocus, inputs locked in flight, query round trip) | TS `e2e/auth.spec.ts` | It already has login mocks. Holding a route open gives the in-flight case. |
| accessibility: Ctrl-click opens a new tab | TS | `context.waitForEvent("page")` with `modifiers: ["Control"]` (`Meta` on macOS runners) |
| accessibility: light-theme focus outline | TS | Computed `outline-style` after keyboard Tab |
| accessibility: episode-stepper labels; write-feedback: episode progress save fails | Python `test_detail.py` | Its TV-detail mocks already exist; rebuilding them in TS would only duplicate them |
| notifications (bells agree, unread before seen, close marks seen) | TS (new `notifications.spec.ts`) | The base mocks already include both notification calls. |
| write-feedback UI failures (clear-watchlist, follow, rating dialog keeps input, unfollow from Following) | TS (new `write-feedback.spec.ts`) | Route returns 500 → assert error toast and unchanged UI. |
| write-feedback double-click, toast dedupe | Jest | `createInflight` / `useToast` behavior is deterministic at hook level. A UI double-click races the network mock. |

**6. README counts are removed, not refreshed.** Per-suite numbers have been wrong in every release since they were added. The Testing section keeps the suite list and the commands. Counts are one command away.

## Risks / Trade-offs

- [Honest tests expose real bugs] → Trivial fixes (a missing `aria-label`, a wrong toast text) land here. Anything larger becomes a backlog entry under the item that owns it (12–14), and the test is marked `xfail(strict=True)` / `test.fixme` with that reference. It then turns red automatically once the bug is fixed.
- [Ctrl-click behaves differently per OS] → Use `ControlOrMeta`, which Playwright resolves per platform.
- [Removing sleeps exposes flakiness that the sleeps were masking] → Run each touched file 3× locally (`--count`/`--repeat-each=3`) before marking its task done.
- [ast parsing breaks if a mock becomes non-literal (e.g. `{**OTHER, ...}`)] → `literal_eval` raises, and the test fails with the mock's name. The mocks then stay literals by convention, stated in a conftest comment.

## Migration Plan

Test and docs only. To roll back, revert the commit.
