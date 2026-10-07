## Why

The live check for `frontend-polish` (7c) on 2026-10-07 found four leftover nav and app-shell bugs (backlog item 8). All four were already present before that change. Two of them break features outright: the notification popup opens partly off-screen at every breakpoint, and on phones there is no way to open the browse filters. The other two are leftovers from the CRA template: an unused `web-vitals` dependency, and React-logo app icons.

## What Changes

- **Notification popup stays on-screen**: give `NotificationBell`'s `Dropdown` an explicit placement for each host. The sidebar footer (left edge, desktop and tablet rail) opens up and to the right. The bottom nav (phone, bell near the bar's center) opens up and is kept inside the viewport. The popup stays mounted inside its sticky host, per the CLAUDE.md rule against `document.body` popups for sidebar triggers.
- **Filters button on phones**: add a Filters control to the phone layout on browse pages (`/movies`, `/tv`, `/anime`). It drives the same `showFilterPanel` state and `FilterPanel` drawer as the sidebar button, so there is still one filter panel and one source of state.
- **Remove `web-vitals`**: uninstall the package and update `package-lock.json`. Its only importer, `src/reportWebVitals.ts`, was deleted in 7c.
- **CINE DB app icons**: replace the React-logo `public/favicon.ico`, `logo192.png` and `logo512.png` with a generated CINE DB wordmark icon. It uses the sidebar logo's gold (`RATING_GOLD`) on the app's dark `theme_color` (`#0d0f1a`). A committed SVG is the source, and the ico/png files are rendered from it. `manifest.json` and `index.html` keep the same file names, so no reference changes.
- **Backlog housekeeping**: mark item 8 proposed. Also mark the stale `tmdb_proxy` `request.GET.dict()` bullet in section 6 as already fixed, since the proxy now uses `request.GET.lists()`.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `notifications`: add a requirement that the notification popup opens fully inside the viewport at phone, tablet and desktop widths.
- `browse-filters`: add a requirement that the browse filter panel can be opened at every responsive tier, including phones.
- `app-identity`: add a requirement that the favicon and installed-app icons show CINE DB branding, not the React logo.

(Removing `web-vitals` is a dependency cleanup with no behavior change, so it gets no spec delta.)

## Impact

- **Frontend**: `src/components/NotificationBell.tsx`, `src/components/BottomNav.tsx` (or a phone-only element in the browse layout; see design), `src/App.tsx` (passing filter state to the phone control), `src/App.css` (phone-only styling, light/dark pair if needed).
- **Assets**: `public/favicon.ico`, `public/logo192.png`, `public/logo512.png`, plus a new SVG source for the icon.
- **Dependencies**: `package.json` and `package-lock.json` lose `web-vitals`.
- **Tests**: e2e coverage for the popup bounds and the phone Filters button (mobile-chrome project). No backend changes and no API changes.
- **Docs**: `docs/BUG_BACKLOG.md` status table and section 6.
