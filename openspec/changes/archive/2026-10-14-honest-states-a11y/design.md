## Context

Frontend only. Motivation and scope are in proposal.md, and requirements are in `specs/`. The code facts that shape the approach (re-checked 2026-10-14):

- `ListsPage.tsx` cards have a card-level `onClick` that navigates. The `Popconfirm` sits in `actions`, and its trigger `Button` stops propagation, but antd portals the confirm popup, and React events bubble through portals by component tree, so OK/Cancel clicks reach the card's `onClick`.
- `useLists` derives `isLoading` from `reloading || loadedGen !== currentSessionGeneration()`, so every background reload is "loading", and `ListsPage` renders a spinner in place of the grid on `isLoading`.
- `RecommendationsPage` has a single `fetchError` boolean shared by three request groups. `computing` is `!fetchError && (… pending)`, so one failed group switches off the "Crunching…" state of the others. The error UI renders only when `totalItems === 0`. It reads `isDataLoading` but not `watchedError`.
- `PersonPage` loads person, movie credits, TV credits and images with `Promise.allSettled`, and turns a rejected credits result into `null`, which looks the same as "no credits".
- `ResetPasswordPage`, `ForgotPasswordPage` and `RegisterPage` read `response.data` themselves instead of calling `getApiError`.
- `ProfileModal`'s `tmdbConnected` starts at `false` ("not connected"), and `null` already means "check failed".
- `FilterPanel` keeps a draft for every control except `includeAdult`, which it writes straight to `UIContext`. `onApply` already receives `{ ...filters, includeAdult }`.
- `AnimePage`'s toggle handler clears genres and reports the media type in one batch (from `spec-test-gaps`), but the category is still reset in an effect after the render that set the new tab. So the first `fetchPage` pairs the new `animeTab` with the old category.
- `SearchBox` hardcodes `id="global-search"`, and it is rendered by both `Sidebar` and `BottomNav`'s drawer.
- `getInitials` is duplicated in `Sidebar.tsx` and `BottomNav.tsx`.

## Goals / Non-Goals

**Goals:**
- Every state the spec deltas name is reachable and covered by a Jest or e2e test.
- Reuse the shared pieces (`LoadError`, `getApiError`, `useActionIconColor`, `ratingColor`, `avatarColor`, `isPlainClick`, `Movie`/`TVShowCard`) instead of adding new local copies.

**Non-Goals:**
- Item 34's other e2e problems (the shadowed DELETE mock in general, unasserted Lists tests beyond the delete test, the TS mock shape check). Only the Lists delete test is fixed here, because it guards this change's fix.
- Any backend or API change.
- Redesigning the For You page. Its group model stays, only its error states change.

## Decisions

1. **Lists Delete: stop propagation at the confirm, keep the card's mouse `onClick`.** Wrap the `Popconfirm` in a `<span onClick={(e) => e.stopPropagation()}>`. The span is the popup's React parent, so OK and Cancel stop there.
   - *Alternative:* drop the card `onClick` and rely on the poster `CardLink`. This loses "click anywhere on the card", which every other list-style card keeps, so it would be a UX change outside this item.
   - Use `ConfirmIconButton`? No: it is an icon button, and the card shows a labelled "Delete" text button. Keep `Popconfirm`, as `ConfirmIconButton` would change the control's look.

2. **Lists background reload: render the grid when `lists.length > 0`, whatever `isLoading` says.** The spinner condition becomes `isLoading && lists.length === 0`. `useLists`'s `isLoading` keeps its meaning (other callers, such as list detail, need "not yet loaded for this session"). This matches how the Watchlist and Watched pages already branch.

3. **For You errors per group.** Replace the `fetchError` boolean with a set of failed groups (`forYou`, `personalized`, `followed`).
   - `computing` looks only at the groups that are still pending and haven't failed.
   - With `totalItems === 0`, nothing computing and a failure → full `LoadError` (unchanged).
   - With items shown, or something still computing, and any failure → an inline `Alert` (warning, "Some recommendations couldn't be loaded.") with a Retry action, above the sections.
   - Retry re-runs all three groups, as it does today. Retrying only the failed group would need a split of the effect for little gain.
   - `complete` (the cache flag) stays false while any group failed, as today.
   - **Watched failure:** branch on `watchedError` before the "No watched titles yet" empty state: `isDataLoading` → spinner, `watchedError && watchedList.length === 0` → `LoadError` whose Retry calls `reloadWatched()`.

4. **Person credits error.** Track `creditsError` when either credits request rejects with something other than a 404. A 404 means none, as `settledData` already treats it. The Tabs area renders `LoadError` with Retry when there are no tabs to show and `creditsError` is set. Retry reruns only the two credits requests: a `creditsReloadKey` effect, so the bio doesn't flash.
   - When one credits request fails and the other has tabs, the tabs that loaded are shown, with an inline `Alert` + Retry above them. A partial failure must not read as a full list either.

5. **Auth pages use `getApiError` only.**
   - Reset password: fallback "Couldn't reset your password. The link may have expired." A DRF `detail` such as "Invalid or expired reset link." still comes through from the body.
   - Forgot password: fallback "Something went wrong. Please try again." `CONNECTION_ERROR` comes from `getApiError` itself.
   - Register: `getApiError(err, "Registration failed.")`. It shows the first field's message, not every field joined. Every server-side field error the form can produce (username taken, email taken, password strength) is a single-field error, so the joined version added nothing but `[object Object]` risk.

6. **TMDB status loading.** `tmdbConnected` becomes `boolean | null | undefined`, starting at `undefined` = checking. The section renders a small `Spin` with "Checking TMDB connection…" while `undefined`. Retry sets it back to `undefined`.

7. **"Include Adult Content" joins the draft.** `FilterPanel` holds `draftAdult`, seeded from `includeAdult` each time it opens, alongside the other draft values. Apply calls `setIncludeAdult(draftAdult)` in the same handler as `onApply` and `setGenres`, so React batches them into one render and one request. Reset sets the draft to off and applies it as Reset does for the rest.
   - The global search box and Search page keep reading `includeAdult` from `UIContext`, so the setting means the same thing everywhere after Apply.
   - The switch gets `aria-label="Include Adult Content"`, the same name as its visible label. A `<label htmlFor>` would also work, but antd `Switch` renders a `button`, which a label only names in some screen readers.

8. **Filter drawer labels.** Give each `Form.Item` a `htmlFor` and its control the matching `id` (`filter-year-from`, `filter-year-to`, `filter-min-rating`, `filter-language`, `filter-min-runtime`, `filter-max-runtime`, `filter-sort`). This avoids `name` (which would make antd's `Form` own the values, but the drawer manages them itself). The year inputs get `max={currentYear + 5}` instead of 2030, and Apply swaps "from" and "to" when from > to. Swapping beats rejecting: the user's intent is clear, and a rejection would be a new error state to design.

9. **Add to List rows.** Each row renders `<Checkbox checked={inList} onChange={toggle}>{list.name}</Checkbox>`, a real labelled checkbox. The `List.Item`'s own `onClick` is removed, so a row click can't toggle twice. The tag with the item count stays as the description. The toggle keeps its inflight dedupe from `useLists`.

10. **Unique search ids.** `SearchBox` takes an `idPrefix` prop (default `"global-search"`). `BottomNav` passes `"mobile-search"`. The `name` attribute stays `search`.

11. **Search cards reuse `Movie`/`TVShowCard`.** The Movies and TV tabs map results through those components with `onKnowMore` doing the existing stash-and-navigate. `Movie`/`TVShowCard` already handle `PosterPlaceholder`, `CardLink`, the watched modal and the watchlist toggle. Their buttons' `aria-label`s are checked to include the title, and the shared components are fixed if not, so browse grids gain it too.
    - Search's extra bits (release year, the media badge, if any) move onto the shared card only if a browse grid would show them too. Otherwise they are dropped. Search should look like browse.

12. **Category buttons.** `disabled={Boolean(searchTerm) || hasFilters}` on Home and Anime. `activeCategory` stays in `fetchPage`'s deps, since disabling makes it unchangeable then anyway.

13. **Anime toggle.** The handler also calls `setActiveCategory(defaultCategory(tab))` and `setAllItems([])`. The effect keeps only the restore guard and `onMediaTypeChange`, or is removed once nothing else depends on it, with `onMediaTypeChange` already called in the handler. One render, one `fetchPage` identity, one request (spec-test-gaps' pattern).

14. **Query value parsing.** A small `parseIntParam(value, { min, allowed?, fallback })` in `src/utils/queryParams.ts`, used by `WatchedPage` for `page`/`pageSize`. Stats and Search compare `tab` against their tab keys and fall back. `PersonPage` already does this inline and is left alone.

15. **Theme and conventions.**
    - **Detail watchlist icon:** use `IN_WATCHLIST_BLUE` when in the watchlist, else `useActionIconColor()`, the same rule as the cards.
    - **Backdrop and `.glass-card`:** `body:not(.dark-theme) .detail-backdrop-gradient` fades to the light theme's background color, and `.glass-card`'s shadow moves under `body.dark-theme` with a softer light sibling (CLAUDE.md's theme-parity rule).
    - **Profile avatar:** `getInitials` moves to `src/utils/initials.ts`, used by `Sidebar`, `BottomNav` and `ProfileModal`, with `avatarColor(username)` as the fallback background.
    - **Stats `ratingColor`:** the local copy is deleted, and the rating-distribution bars use `ratingColor()` from `utils/colors.ts`. Its thresholds and colors (`WATCHED_GREEN`/`RATING_WARN`/`RATING_BAD`) are the app-wide rule. The `PALETTE` named constants stay, because CLAUDE.md lists them as the deliberate exception. Only the two inline hex entries in `PALETTE` become named constants.
    - **Money:** budget/revenue are formatted through a fixed `Intl.NumberFormat("en-US")`, since they're USD amounts.
    - **Small fixes:** `NotFoundPage` imports `isPlainClick`. The cast `key` becomes `` `${actor.id}-${actor.credit_id ?? index}` ``. The Search/People skeleton callers drop the outer `Row`.

16. **Plausibles, checked during apply.** SearchBox syncing with `?q=` and a picked recent search, and `StarRating` wrapping at 320 px, are checked with Playwright first. They are fixed only if they reproduce, and a non-reproducing one is noted in the backlog as not reproduced.

## Risks / Trade-offs

- **Adult setting moves behind Apply.** A user used to an instant toggle may not notice they need Apply. → The drawer's Apply button already gates every other control. The spec makes it consistent, and Reset still clears it.
- **Search cards change look.** They now match the browse cards. → Intended (spec). The e2e search tests' selectors may change. They are updated, not loosened.
- **Partial-failure Alert on For You might show alongside a still-computing spinner.** → Intended. The spec says the failure must not hide the computing state.
- **Register shows one field error instead of all.** → Only one server field error is possible at a time in practice. Client-side form validation still flags each field.
- **e2e and Jest selectors that rely on the old markup** (Add to List rows, `#global-search` on phone). → Update the selectors in the same task as the markup change.

## Migration Plan

Frontend only, no data migration. Rollback is reverting the commit.
