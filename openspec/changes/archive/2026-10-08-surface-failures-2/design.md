## Context

See proposal.md. All findings were re-checked against the code on 2026-10-08. Two facts shape the design:
- Every library-style load already follows `surface-failures`' pattern: loading → `<LoadError onRetry>` → empty → content. The pieces this change touches are the ones that never got it.
- `getApiError` (`src/utils/apiError.ts`) has 53 callers. When there's no response body, it returns `axiosError.message` for *any* error. That leaks axios' English ("Network Error") and also JS runtime messages from non-axios errors thrown inside a `try`.

## Goals / Non-Goals

**Goals:**
- No touched view shows "empty", "not following" or "not connected" when the truth is "we couldn't load it".
- No form in scope can send two requests from one double-click.
- No error toast ever shows a fragment of a response body.

**Non-Goals:**
- A unique `(user, name)` constraint on lists. Decided 2026-10-08: block the double-submit only. Import All keeps matching by name and takes the first match.
- Reworking `AppContext.searchTerm` into a URL-only model. The URL becomes the source a page loads from, and the context stays the live value (see Decision 8).
- Backend changes. None are needed.

## Decisions

**1. `FollowedPeopleContext` gets `error` and `retry()`. Person cards don't guess while it's set.**
- On failure: `error = true`, `followed` unchanged, `loaded = true`. `retry()` clears `error` and refetches, through the same effect, keyed on a `retryToken`.
- FollowingPage branches loading → `<LoadError onRetry={retry}>` → empty → content.
- `PersonCard`'s Follow button is disabled while `error`, with a tooltip saying follow status couldn't be loaded. Showing "Follow" would claim "not following". Clicking it would usually still work (the server's `get_or_create` makes it idempotent), but it would contradict a real follow.
- *Rejected: an optimistic "Follow" button that re-checks on click.* That still shows false state on every card.

**2. Stale responses are dropped by a per-request id, not by `AbortController`.**
- Calendar keeps `requestIdRef`. `fetchCalendar` captures `const id = ++requestIdRef.current` and applies `groups`/`error`/`loading` only if `id === requestIdRef.current`.
- HeroBanner and FollowingPage's recommendations effect use the usual `let cancelled = false` cleanup.
- *Rejected: abort signals.* `api/tmdb.ts` callers don't accept a signal today, and threading one through `discoverMovies`/`discoverTV` and the Calendar's paging loop is more churn for the same visible result. The extra in-flight request is harmless.

**3. `getApiError` rules, in order:**
1. Not an axios error → `fallback`. A thrown JS error's message is never user text.
2. Axios error with no `response` (network failure, CORS, timeout: `ERR_NETWORK`, `ECONNABORTED`, `ETIMEDOUT`) → "Can't reach the server. Check your connection and try again." This is the same wording LoginPage already uses, exported as one constant so they can't drift.
3. `response.data` not a plain object (an HTML string, an empty string, an array, null) → `fallback`.
4. Otherwise, today's object handling (`detail`, `non_field_errors`, first field), with each value accepted only if it is a non-empty string or an array of strings.

`fallback` stays the call site's message. *Rejected: a generic "The server had a problem" for every 5xx (the backlog's first idea).* "Failed to save rating." says more, and the `honest-tests` write-feedback tests already pin the call-site fallback on 500s.

**4. Double-submit guards live in the hooks, plus a busy UI:**
- `useLists`: `createList` runs in `inflight.run("create-" + name.trim().toLowerCase(), …)`, and `updateList` in `inflight.run("list-" + id, …)`. The latter shares the slot `deleteList`/`clearList` already use: one write per list at a time.
- `ListsPage`'s create modal and `ListDetailPage`'s edit modal get `confirmLoading`. `AddToListModal`'s inline create is covered by the hook.
- `RegisterPage` gets `loading`/`disabled` on submit, like LoginPage after `honest-tests`.
- *Rejected: a hook guard alone.* A double-click would still show two toasts. The hook returns the same promise to both callers, but each caller toasts on settle. `useToast` dedupes identical text by key, so it would show one, but the busy button is the honest signal.

**5. Sidebar avatar becomes a real `<button>`.**
- It wraps the existing `Avatar` in `<button type="button" className="sidebar-avatar-btn" aria-label="Edit profile">`, with a CSS reset in `App.css` (no border/background, inherits size) and a `:focus-visible` outline in a light/dark pair, per the theme-parity rule.
- Sign Out gets `aria-label="Sign out"`. The sidebar's unreachable "Sign In" branch is deleted: `App.tsx` renders `Sidebar` only when signed in.
- The tablet/collapsed rail re-targets `.sidebar-user-row` children. The button must not change the row's height, so check `scrollHeight` vs `clientHeight` at 1366×768 per the CLAUDE.md sidebar budget.

**6. CardLink conversions follow the existing "card has buttons → poster-only link" rule:**
- **Search movie/TV result cards:** the poster area becomes a `CardLink to="/movie/:id"` with `onNavigate` keeping the current `navigate(...)` call. The card-level mouse `onClick` stays, with `stopPropagation` on the link, as in `PersonCard`.
- **RecommendationsPage `SectionRow`** (also used by Following): same, with `onNavigate={() => navigate(path, { state })}`.
- **Lists page cards:** the cover and the list name become one `CardLink to="/lists/:id"`, labelled with the list name. The Delete button stays outside it.
- CLAUDE.md's CardLink rule then holds everywhere, and its "3 exceptions in code" drift note goes away.

**7. `.ics` building moves to `src/utils/ics.ts` (`buildIcs(groups, now)`), so it's unit-testable without a download.**
- `icsText()` escapes `\` first, then `;` `,` and newlines (`\n`).
- `fold()` splits at 75 *octets*: it measures with `TextEncoder`, never breaks inside a UTF-8 sequence, and continues lines with CRLF + space.
- `DTSTAMP` is `now` in UTC (`YYYYMMDDTHHMMSSZ`).

**8. Search term in the URL:**
- `SearchBox` submit navigates to `/search?q=<term>`, plus `&tab=<tab>` when already on `/search` with a tab, and still sets `searchTerm` in context as today.
- `SearchPage` reads `q` and, when it differs from the context value, calls `setSearchTerm(q)` (a layout effect, before the tabs' fetchers read it). So a reload, a shared link or a login return shows results.
- The per-tab sessionStorage caches are already keyed by query, so they keep working.
- *Rejected: making the URL the only store.* `searchTerm` feeds the sidebar box, Home's local filter and the caches, so that's a wider refactor for no extra user-visible gain.

**9. TMDB connection status becomes `boolean | null` (`null` = couldn't check).**
- The `null` state shows "Couldn't check your TMDB connection." with a Retry link, in place of the Connect/Disconnect button.

## Risks / Trade-offs

- [The PersonCard Follow button is disabled during a followed-people error on every grid] → It's the honest state, and the tooltip says why. Retry is one click away on Following, and the next app load retries anyway.
- [Converting the Search/Recommendations cards could break their mouse behavior] → `CardLink` + `stopPropagation` + card `onClick` is already proven in `PersonCard`. The existing Python e2e search and recommendation tests cover mouse paths, and new TS tests cover keyboard and Ctrl-click.
- [The sidebar avatar button could add height in the 64px rail] → It reuses the avatar's 36px box. Re-measure per the sidebar budget.
- [`getApiError` changes text for 53 callers] → Only the broken cases change (non-object body, no response, non-axios error). Object bodies keep today's output. Unit tests pin each rule.

## Migration Plan

Frontend only. To roll back, revert the commit.
