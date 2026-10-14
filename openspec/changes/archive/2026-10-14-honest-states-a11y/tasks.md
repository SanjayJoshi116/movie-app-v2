## 1. Lists page: delete confirm and background reload

- [x] 1.1 `ListsPage`: wrap the card's `Popconfirm` in a `stopPropagation` span so OK/Cancel never reach the card's `onClick`; render the spinner only when `isLoading && lists.length === 0`
- [x] 1.2 e2e (`e2e/python/test_lists.py` delete test): assert the DELETE request was sent for that list id, the URL is still `/lists`, and Cancel leaves the URL and list unchanged; fix the shadowed DELETE mock it depends on (method branch in one handler)
- [x] 1.3 Jest: a background `reloadLists` keeps the cards rendered

## 2. For You: per-group failures and watched failure

- [x] 2.1 `RecommendationsPage`: replace `fetchError` with a failed-groups set; `computing` ignores failed groups; inline warning `Alert` + Retry when a group failed and items are shown or a group is still computing; full `LoadError` only when nothing is shown or computing
- [x] 2.2 `RecommendationsPage`: read `watchedError`/`reloadWatched`; `LoadError` (Retry → `reloadWatched()`) instead of "No watched titles yet" when the watched load failed with nothing loaded
- [x] 2.3 Jest: followed fails after for-you loaded → sections + inline error; followed fails while personalized pending → computing text + inline error; watched load failed → `LoadError`, not the empty state; Retry refetches

## 3. Person credits, People empty state, TMDB status

- [x] 3.1 `PersonPage`: `creditsError` when a credits request rejects with a non-404; `LoadError` + Retry in the credits area when no tabs, inline `Alert` + Retry above partial tabs; Retry reruns only the credits requests
- [x] 3.2 `PeoplePage`: empty state naming the search when a search completes with zero results; drop the extra `Row` around `SkeletonCard` (same on SearchPage)
- [x] 3.3 `ProfileModal`: `tmdbConnected` starts `undefined`; show "Checking TMDB connection…" with a spinner until it answers; Retry resets to `undefined`
- [x] 3.4 Jest: person credits fail → error with Retry, success empty → "No credits available"; People no-match → empty state; TMDB section offers neither Connect nor Disconnect before the check answers

## 4. Readable errors on auth pages

- [x] 4.1 `ResetPasswordPage`, `ForgotPasswordPage`, `RegisterPage`: errors only through `getApiError(err, fallback)` with the fallbacks from design decision 5
- [x] 4.2 Jest: reset with no response → `CONNECTION_ERROR`; reset with HTML 502 → the fallback, not "Invalid or expired reset link."; forgot password offline → `CONNECTION_ERROR`; register with a nested body → no `[object Object]`

## 5. Browse: adult draft, category buttons, Anime toggle

- [x] 5.1 `FilterPanel`: `draftAdult` seeded on open; Apply sets it with `onApply`/`setGenres` in one handler; Reset clears it; `aria-label="Include Adult Content"` on the switch
- [x] 5.2 `HomePage`/`AnimePage`: category buttons `disabled` while `searchTerm || hasFilters`
- [x] 5.3 `AnimePage`: the toggle handler sets the new mode's default category and clears items; remove the effect's category reset (keep the restore guard)
- [x] 5.4 Jest (`FilterPanel.test.tsx`, Anime/Home): adult switch closed without Apply changes nothing; Apply with adult + rating sends one request with both; Anime TV→Movies sends one movie discover with no airing params; category buttons disabled during a search
- [x] 5.5 e2e (TS browse spec): update any test that toggled adult content without Apply

## 6. Accessibility

- [x] 6.1 `FilterPanel`: `htmlFor` on every `Form.Item` + matching `id` on its control; year `max` = current year + 5; Apply swaps year from/to when from > to
- [x] 6.2 `AddToListModal`: each row a labelled `Checkbox` (list name) that toggles; remove the `List.Item` `onClick`
- [x] 6.3 `SearchBox`: `idPrefix` prop (default `global-search`); `BottomNav` passes `mobile-search`
- [x] 6.4 `SearchPage` Movies/TV tabs: render results through `Movie`/`TVShowCard` with the existing stash-and-navigate `onKnowMore`; make sure the shared cards' button `aria-label`s include the title (fix in the shared components if not)
- [x] 6.5 Tests: Jest for labelled drawer controls (`getByLabelText`) and Add to List checkbox by name; e2e: after opening the phone Search drawer, `#global-search` count ≤ 1; Search results show a watchlist button; update Add to List / search selectors that relied on old markup

## 7. Query values fall back to defaults

- [x] 7.1 `src/utils/queryParams.ts`: `parseIntParam(value, { min, allowed, fallback })`; `WatchedPage` uses it for `page` (≥ 1, integer) and `pageSize` (12/24/48/96)
- [x] 7.2 `StatsPage`/`SearchPage`: an unknown `tab` falls back to the default tab
- [x] 7.3 Jest: `parseIntParam` cases (`-2`, `1.5`, `abc`, `0`, allowed list); Watched `?page=-2` and `?pageSize=-5` show page 1 at 48; Stats/Search unknown tab shows the default tab

## 8. Theme and conventions

- [x] 8.1 `MovieDetails`/`TVShowDetails`: watchlist icon `IN_WATCHLIST_BLUE` when in the watchlist, else `useActionIconColor()`; cast `key` unique per credit; budget/revenue through a fixed `en-US` `Intl.NumberFormat`
- [x] 8.2 `App.css`: light sibling for `.detail-backdrop-gradient`; `.glass-card` shadow scoped per theme
- [x] 8.3 `src/utils/initials.ts` (`getInitials`), used by `Sidebar`, `BottomNav`, `ProfileModal`; `ProfileModal`'s fallback avatar uses `avatarColor(username)`
- [x] 8.4 `StatsPage`: delete the local `ratingColor`, use `utils/colors.ts`'s; name the two inline hex values in `PALETTE`
- [x] 8.5 `NotFoundPage`: use `isPlainClick` from `CardLink.tsx`

## 9. Plausibles

- [x] 9.1 Playwright check: SearchBox shows the term after opening `/search?q=…` directly and after picking a recent search; fix if it doesn't
- [x] 9.2 Playwright check at 320 px: the rating dialog's 10-star `StarRating` stays on one line; fix if it wraps
- [x] 9.3 Record any plausible that didn't reproduce in `docs/BUG_BACKLOG.md` item 32

## 10. Docs and verification

- [x] 10.1 CLAUDE.md: the adult switch is part of the filter draft; `SearchBox` `idPrefix`; query params through `parseIntParam`; `getInitials` in `utils/initials.ts`; Search uses `Movie`/`TVShowCard`
- [x] 10.2 CHANGELOG `[Unreleased]`; README tree for new utils/tests; `features.txt` for user-visible changes; `docs/BUG_BACKLOG.md` item 32 → 📝 now, ✅ on archive
- [x] 10.3 Run `npm run typecheck`, `npm run lint`, the full Jest suite, and only the e2e specs the change touches (lists, recommendations, person, auth pages, browse/filters, search, add-to-list, responsive, stats, watched, profile)
