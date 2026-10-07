## 1. Notification popup on-screen

- [x] 1.1 Add a `placement` prop to `NotificationBell.tsx` and pass it to the `Dropdown`. Keep `getPopupContainer` on the trigger's parent.
- [x] 1.2 Pass `placement="topLeft"` (with `autoAdjustOverflow={false}`, see design 1a) from `Sidebar.tsx` and `placement="top"` from `BottomNav.tsx`.
- [x] 1.3 ~~Add the phone-only horizontal pin~~ Not needed: `top` alone keeps the popup on-screen at 320px and 375px, on browse (7 buttons) and non-browse pages (e2e). Instead, the rail footer became a 2-column icon grid (design 1b), because the bell itself was clipped off the rail's left edge.
- [x] 1.4 Under `npm run dev`, measure the open popup's `getBoundingClientRect()` at 1366×768 (sidebar expanded and collapsed), 800×1024 and 375×812. All edges must be inside the viewport. Scroll a browse page with the popup open and confirm it stays anchored. If a host still overflows, apply the design's fallback pin to it.

## 2. Phone Filters control

- [x] 2.1 Pass `isBrowsePage`, `showFilterPanel` and `onToggleFilterPanel` from `App.tsx` to `BottomNav`.
- [x] 2.2 In `BottomNav.tsx`, render a `FilterOutlined` icon button after Watchlist, on browse pages only. Give it `aria-label="Toggle filters"`, `aria-expanded`, gold when open, and `useFlashTooltip` like its siblings.
- [x] 2.3 At 375px on `/movies`, `/tv` and `/anime`: the button opens `FilterPanel`, and applying a filter changes the results. The button is absent on `/watchlist`. At 320px, all bottom-nav buttons fit on one row without overflow.

## 3. App icons

- [x] 3.1 Create `public/icon.svg`: a 512×512 rounded square in `#0d0f1a` with a bold "C" monogram in `RATING_GOLD`, the glyph outlined as a `<path>` (Poppins 700).
- [x] 3.2 With a scratch `verify_*` script, render `logo512.png` and `logo192.png` from the SVG (Playwright) and build `favicon.ico` with 16/24/32/64 frames (Pillow, Django env). Then delete the script.
- [x] 3.3 Check that each file's pixel size matches `manifest.json`, and that the favicon shows the new icon in the browser tab. Add a one-line note to `docs/ARCHITECTURE.md` on how to regenerate the icons from `icon.svg`.

## 4. Dependency cleanup

- [x] 4.1 Grep `src/` and `e2e/` to confirm nothing imports `web-vitals`. Then run `npm uninstall web-vitals` and check that `package.json` and `package-lock.json` both drop it.

## 5. Tests

- [x] 5.1 Add TS e2e coverage (`e2e/responsive.spec.ts`, on `e2e/fixtures.ts`): the notification popup's bounding box is inside the viewport on desktop and mobile-chrome.
- [x] 5.2 Add a mobile-chrome e2e test: the Filters button is in the bottom nav on `/movies` and opens the filter drawer, and it is absent on `/watchlist`.
- [x] 5.3 Run `npm run typecheck`, `npm run lint` and `npx playwright test`. All must pass.

## 6. Docs

- [x] 6.1 In `docs/BUG_BACKLOG.md`, set item 8 to 📝 `fix-nav-polish` (✅ on archive). Mark section 6's stale `tmdb_proxy` `request.GET.dict()` bullet as already fixed (`request.GET.lists()`).
- [x] 6.2 In `CLAUDE.md`, note that `NotificationBell` takes a per-host `placement` and that `BottomNav` carries the phone Filters button.
