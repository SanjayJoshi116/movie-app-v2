## Why

Backlog item 13 (2026-10-07 audit, plus H1 from `honest-tests`; all re-checked 2026-10-08). The first `surface-failures` change left several frontend gaps:
- Failed loads still look like "nothing": Following shows "not following anyone", and Calendar shows "no releases".
- Stale responses overwrite current ones: a Calendar filter switch, or the Anime hero.
- Forms can double-submit: Register, create list, edit list.
- Error toasts can show a single `<` when the server returns an HTML error page.
- Some account controls can't be reached from the keyboard.

Each one shows the user something false.

## What Changes

- **Failures shown as failures:**
  - `FollowedPeopleContext` exposes `error` + `retry()`, and FollowingPage shows `<LoadError onRetry>` instead of the empty state (F2).
  - Calendar shows `<LoadError onRetry>` on failure (F3).
  - The "from people you follow" recommendations show an error line with Retry (N5).
  - The profile dialog shows an "unknown" TMDB-connection state when the status check fails, not "Connect" (N5).
- **No stale responses:**
  - Calendar ignores any response that isn't from the latest filter (F4).
  - HeroBanner ignores a response for a `mediaType` it has since left (N4).
  - The Following recommendations effect gets a cancel (N5).
- **Forms submit once:**
  - Register's submit button gets `loading`/`disabled` (F8).
  - `createList` and `updateList` get in-flight slots, and the create and edit modals get `confirmLoading` (N2, N3). This also covers `AddToListModal`'s inline create.
  - Duplicate list names stay allowed (decided 2026-10-08).
- **Readable error text** (`getApiError`, R1):
  - Only object bodies are read. An HTML or string body falls back to the call site's message.
  - Network errors and timeouts become "Can't reach the server. Check your connection and try again."
- **Keyboard and names:**
  - The sidebar avatar becomes a real button labelled "Edit profile" (S1).
  - Sign Out gets `aria-label="Sign out"`, and the unreachable sidebar "Sign In" branch is removed (S2).
  - These cards become `CardLink`s: the Lists page cards (F5), Search's Movies/TV result cards, and the Recommendations/Following `SectionRow` cards. Since these cards hold their own buttons, only the poster (and, for lists, the name) is the link. Decided 2026-10-08: convert them and keep the CardLink rule global.
- **Dates (F7):** the Lists page shows `createdAt` as the device's local day (`formatDateInTz`), and Stats' "recently watched" badges use `dd-mm-yyyy`.
- **Calendar `.ics` (S4):** add `DTSTAMP`, escape `SUMMARY` text, fold lines over 75 octets.
- **Browse infinite scroll (S6):** Home and Anime cap `totalPages` at TMDB's 500, as Search and People already do.
- **Search term in the URL (H1):**
  - Searching navigates to `/search?q=<term>` and keeps the current `tab`.
  - SearchPage reads `q` on load, so reload, a shared link or a login round trip shows the same results and tab.

## Capabilities

### New Capabilities
- `calendar-export`: the release calendar's `.ics` download is a valid iCalendar file that calendar apps accept, whatever the titles contain.

### Modified Capabilities
- `load-states`:
  - Following and Calendar failures are shown as failures with Retry
  - background sections and status checks don't fake an answer
  - a superseded response never replaces the current one
  - infinite scroll ends at the source's last page
- `write-feedback`:
  - form submits (register, create list, edit list) send one request per activation
  - error messages are always readable sentences
- `accessibility`:
  - the card-link list grows to include list cards, search result cards and recommendation cards
  - the profile and sign-out controls are keyboard-reachable and named
- `local-dates`: list creation dates and Stats' recent-watch dates follow the display convention.
- `view-state-restore`: a search is addressable by URL (term and tab).

## Impact

- **Frontend only.** No API or model changes:
  - `FollowedPeopleContext.tsx`, `FollowingPage.tsx`, `CalendarPage.tsx`, `HeroBanner.tsx`, `ProfileModal.tsx`
  - `RegisterPage.tsx`, `useLists.ts`, `ListsPage.tsx`, `ListDetailPage.tsx`, `utils/apiError.ts`
  - `Sidebar.tsx`, `SearchPage.tsx`, `SearchBox.tsx`, `RecommendationsPage.tsx`, `StatsPage.tsx`, `HomePage.tsx`, `AnimePage.tsx`
- **Tests:**
  - Jest: `apiError`, `useLists`, `FollowedPeopleContext`, an `.ics` builder
  - TS e2e: Following/Calendar errors, Calendar race, keyboard access, URL search. The login round-trip test in `e2e/auth.spec.ts` can then assert the People tab (H1).
- **Docs:**
  - CLAUDE.md: remove the "Calendar transiently empty" note (it was F3), state `getApiError`'s rules, and note that the CardLink rule now has no exceptions
  - `docs/BUG_BACKLOG.md` status
