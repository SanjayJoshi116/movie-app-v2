Same rule as `honest-tests`: a task that adds or changes a test is done only when that test has been shown to fail against a temporary break of the behavior it covers, then the break was reverted.

## 1. Readable errors (R1)

- [x] 1.1 Export `CONNECTION_ERROR = "Can't reach the server. Check your connection and try again."` from `utils/apiError.ts`, and use it in `LoginPage.tsx`
- [x] 1.2 Rewrite `getApiError` per design Decision 3:
  - non-axios error → fallback
  - no response → `CONNECTION_ERROR`
  - non-object body → fallback
  - object body: string / string-array values only
- [x] 1.3 Jest `utils/__tests__/apiError.test.ts` covering:
  - HTML 502 body
  - empty-string 500 body
  - array body
  - `{detail}`, `{non_field_errors: [...]}`, `{username: [...]}`
  - `ERR_NETWORK`, `ECONNABORTED` timeout
  - thrown `TypeError`

## 2. Failures shown as failures (F2, F3, N5)

- [x] 2.1 `FollowedPeopleContext`: keep `followed` on failure, set `error`, and add `retry()` (via a `retryToken` dep). Expose both through `useFollowedPeople()`
- [x] 2.2 `FollowingPage`: loading → `<LoadError onRetry={retry}>` → empty → content
- [x] 2.3 `PersonCard`: Follow/Unfollow button disabled with an explanatory tooltip while the followed-people `error` is set
- [x] 2.4 `FollowingPage` recommendations:
  - cancelled flag in the effect
  - an error line with Retry on failure, instead of hiding the section
- [x] 2.5 `CalendarPage`: an `error` state set in the catch, and `<LoadError onRetry>` rendered instead of the empty list
- [x] 2.6 `ProfileModal`:
  - TMDB status becomes `boolean | null`
  - `null` (check failed) shows "Couldn't check your TMDB connection." with Retry, not the Connect button
- [x] 2.7 Jest for `FollowedPeopleContext`: failure keeps the previous list, sets `error`, and `retry()` refetches and clears it
- [x] 2.8 TS e2e (`e2e/load-failures.spec.ts`): failing route → `LoadError` → Retry with a good route → content, for:
  - the Following page
  - the Calendar
  - the Following recommendations error line
  - the profile dialog's TMDB "couldn't check" state

## 3. Stale responses (F4, N4) and the page cap (S6)

- [x] 3.1 `CalendarPage`: a `requestIdRef`; only the latest request may set `groups`/`error`/`loading`
- [x] 3.2 `HeroBanner`: a cancelled flag in the fetch effect
- [x] 3.3 TS e2e race on the Calendar: hold the "All" movie response, switch to "TV Shows", release it, and assert only TV items show
- [x] 3.4 `HomePage` and `AnimePage`: `totalPages: Math.min(response.data.total_pages, 500)`
- [x] 3.5 Jest or e2e for the cap: mock `total_pages: 9999`, and assert no request for page 501 is made once page 500 is loaded (drive `usePaginatedFetch` directly in Jest if the UI path is too slow)

## 4. Forms submit once (F8, N2, N3)

- [x] 4.1 `RegisterPage`: `loading`/`disabled` on submit while in flight
- [x] 4.2 `useLists`: `createList` in `inflight.run("create-" + normalized name)`, and `updateList` in `inflight.run("list-" + id)`
- [x] 4.3 Add `confirmLoading` to `ListsPage`'s create modal and `ListDetailPage`'s edit modal
- [x] 4.4 Jest `useLists`:
  - double `createList` with the same name sends one POST
  - double `updateList` sends one PATCH
  - different names stay independent
- [x] 4.5 TS e2e:
  - Register double-click sends one POST
  - New List double-click on OK creates one list (assert the POST count)

## 5. Keyboard access and names (S1, S2, F5, CardLink conversions)

- [x] 5.1 `Sidebar.tsx`:
  - wrap the avatar in `<button className="sidebar-avatar-btn" aria-label="Edit profile">`
  - add the CSS reset and the light/dark `:focus-visible` pair in `App.css`
  - give Sign Out `aria-label="Sign out"`
  - delete the unreachable "Sign In" branch
- [x] 5.2 Re-measure the sidebar at 1366×768, both collapsed and expanded, plus the tablet rail: no new scrollbar and no row height change
- [x] 5.3 `ListsPage`: the cover + name become a `CardLink to="/lists/:id"` labelled with the list name. Delete stays outside it
- [x] 5.4 `SearchPage` Movies/TV cards: the poster becomes a `CardLink` (`onNavigate` keeps the current navigate call, `stopPropagation`), and the card-level `onClick` stays for mouse
- [x] 5.5 `RecommendationsPage` `SectionRow` (also Following): same treatment as 5.4
- [x] 5.6 TS e2e (`e2e/accessibility.spec.ts`):
  - desktop: Tab to the avatar, Enter opens the profile dialog
  - Sign Out has the name "Sign out"
  - Lists: Tab to a list, Enter opens it
  - Search and Recommendations: Ctrl/Cmd-click opens a new tab and the current page stays

## 6. Dates (F7), .ics (S4), search URL (H1)

- [x] 6.1 `ListsPage`: `formatDateInTz(list.createdAt)`. `StatsPage` recent badges: `formatDateDMY(item.watchedAt)`
- [x] 6.2 Tests:
  - Jest or e2e: a list `createdAt` of `2024-01-15T23:30:00-05:00` renders `15-01-2024` under `timezoneId: "America/New_York"`
  - Python `test_stats.py`: the recent badge shows `15-01-2024`
- [x] 6.3 `src/utils/ics.ts`: `buildIcs(groups, now)` with `icsText()` escaping, octet-aware `fold()` and `DTSTAMP`. `CalendarPage.exportIcal` calls it
- [x] 6.4 Jest `utils/__tests__/ics.test.ts` covering:
  - escaping (`\`, `;`, `,`, newline)
  - every VEVENT has `DTSTAMP`
  - a 200-char title (with multibyte characters) folds at ≤75 octets and unfolds back exactly
- [x] 6.5 `SearchBox`: navigate to `/search?q=…` (+ the current `tab` when on `/search`). `SearchPage`: read `q` and sync it into `searchTerm` when they differ
- [x] 6.6 Tests:
  - TS e2e: reload `/search?q=nolan&tab=people` shows People results
  - TS e2e: a new search from the TV tab stays on TV
  - `e2e/auth.spec.ts`: the login round-trip test now uses `?q=…&tab=people` and asserts the People tab is active, and its H1 comment is removed

## 7. Docs and verification

- [x] 7.1 CLAUDE.md:
  - remove the "Calendar transiently empty" verification note (it was F3)
  - add `getApiError`'s rules next to the load/write feedback bullet
  - CardLink rule: no exceptions remain
  - FollowedPeople: `error`/`retry`
- [x] 7.2 `docs/ARCHITECTURE.md`: a short bullet each for the stale-response id pattern and search-in-URL
- [x] 7.3 Run `npm run typecheck`, `npm run lint`, Jest, the TS Playwright suite (both projects), the Python e2e suite, and backend pytest (as a guard)
- [x] 7.4 `docs/BUG_BACKLOG.md`: item 13 → 📝 now, ✅ on archive. Close the open decision (13 vs 15) as decided 2026-10-08, and record N2's decision (no unique names)
