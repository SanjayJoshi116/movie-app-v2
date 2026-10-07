## Why

Parts of the app can't be used with a keyboard or a screen reader, and two routes behave in surprising ways:
- **Keyboard:** most poster cards that open a detail page are plain clickable `div`s and `Card`s. Tab skips them, so a keyboard user can't open a recommendation, a cast member, a calendar release or a person.
- **Screen reader:** the TV episode-progress controls are unlabeled icon buttons. A screen reader announces them as just "button".
- **Unknown URL:** a mistyped address silently redirects to Movies, so the user never learns the link was wrong.
- **Auth pages:** a signed-in user can open `/login` or `/register` and see a login form, even though they're already signed in.

These are the "Accessibility/routing" items of backlog #7. Sibling changes cover the other #7 groups (`ci-coverage`, `fix-dependency-drift`, `frontend-polish`, `harden-docker`).

## What Changes

### Keyboard-reachable poster cards
Every card that opens a detail page becomes a real link: focusable with Tab, opened with Enter, and openable in a new tab with a middle-click or Ctrl/Cmd+click. The affected places:
- **`MediaCardGrid`:** detail-page Recommendations and Similar, and the Movies/TV credit tabs on the person page. The whole card becomes the link.
- **Cast cards** on the movie and TV detail pages. The whole card becomes the link.
- **Home "Recently Watched" strip.** Each poster becomes a link.
- **Calendar release cards.** The whole card becomes the link.
- **`PersonCard`** (People, Search → People, Following). The poster becomes the link; the card keeps its mouse click, and the follow button stays a separate control.
- **`LibraryItemCard`** (Watchlist, Watched, List detail). The poster becomes the link; the action buttons stay separate controls.

Focused cards get a visible focus outline in both light and dark themes.

Unchanged: cards that already have a "Details" button (browse grids, For You, Search movie/TV tabs) already have a keyboard path.

### Accessible names
The TV detail page's icon-only episode-progress buttons get labels:
- remove progress
- previous / next season
- previous / next episode

### Routing
- **Unknown paths:** an unknown path shows a "Page not found" page, with a link back to Movies, instead of silently redirecting.
- **Signed-in users on auth pages:** a signed-in user who opens `/login`, `/register` or `/forgot-password` is sent on, either to the page they were originally headed to (the same `from` rule the login page uses) or to Movies.
- **No login-form flash:** while the session is still being restored, these pages render nothing, so the login form doesn't flash for a user who turns out to be signed in.
- **Password reset links:** `/reset-password/...` stays reachable when signed in, because a reset link from email must keep working.

## Capabilities

### New Capabilities
- `accessibility`: covers keyboard reachability and accessible names for interactive UI, including a visible focus indicator in both themes.
- `routing`: covers app-level route behavior, i.e. the not-found page for unknown paths and where signed-in users go when they open sign-in/sign-up pages.

### Modified Capabilities
<!-- None. The login-page spec's post-login redirect requirement is reused as-is: routing points to the same "original location" rule rather than changing it. -->

## Impact

- **Frontend only.** No backend or API changes.
- **New files:**
  - `src/components/CardLink.tsx`
  - `src/pages/NotFoundPage.tsx`
  - `src/utils/postLoginPath.ts` (the `from` computation, shared by `LoginPage` and `App`)
- **Changed files:**
  - `MediaCardGrid.tsx`, `MovieDetails.tsx`, `TVShowDetails.tsx`
  - `HomePage.tsx`, `CalendarPage.tsx`
  - `PersonCard.tsx` and `LibraryItemCard.tsx`, plus their callers (`WatchlistPage`, `WatchedPage`, `ListDetailPage` pass a `to` path)
  - `App.tsx`, `LoginPage.tsx`, `App.css` (focus rule, light/dark pair)
- **Tests:** new Python e2e tests for keyboard opening, the 404 page and the signed-in `/login` redirect. Existing e2e tests that click cards should keep passing, because the card areas still respond to a mouse click.
