## Context

See proposal.md (Why). Constraints from the current code:

- `NotificationBell` is rendered in two hosts: `Sidebar.tsx`'s footer row (desktop 220px sidebar, tablet 64px rail, desktop manual-collapse rail) and `BottomNav.tsx` (phone, after Movies/TV/Watchlist). Its `Dropdown` sets no `placement`, so it uses antd's default `bottomLeft`. `getPopupContainer` returns the trigger's parent, so the popup lives inside the sticky sidebar or the fixed bottom nav. Overflow adjustment then measures against that container instead of the viewport, and the popup lands about 85–290px left of the screen.
- CLAUDE.md requires sidebar popups to stay inside the sidebar (no `document.body` container), because antd's scroll-linked repositioning glitches against a sticky trigger. The bottom nav is `position: fixed`, which has the same problem.
- The filter toggle state (`showFilterPanel`) and `isBrowsePage` live in `App.tsx` and only reach `Sidebar`. Below 768px the sidebar is hidden by CSS, and `BottomNav` gets no props.
- Breakpoints are CSS-only. No JS width checks anywhere (CLAUDE.md).
- The bottom nav has 6 icon buttons (`.bottom-nav-btn`, `justify-content: space-around`, padding shrinks below 360px).

## Goals / Non-Goals

**Goals:**
- One `NotificationBell` component, with its placement chosen per host and not per viewport width.
- The phone Filters control reuses the existing `FilterPanel` instance and `showFilterPanel` state.
- Icons are reproducible from a committed source.

**Non-Goals:**
- Showing a bottom nav or sidebar to signed-out users (both are auth-gated today; unchanged).
- Redesigning the notification popup's content, or moving it into a Drawer on phones.
- A full brand or logo system. The icon is a simple monogram.
- Adding an SVG favicon `<link>` or new manifest entries. File names and references stay as they are.

## Decisions

### 1. Popup placement is a prop chosen by the host

`NotificationBell` gets a `placement` prop:
- `Sidebar` passes `"topLeft"`: the popup grows up and to the right from the bell, which sits near the bottom-left of the screen.
- `BottomNav` passes `"top"`: the popup is centered above the bell.

`getPopupContainer` stays as the trigger's parent. Antd's `autoAdjustOverflow` stays on. In the rail, the bell sits at the screen's left edge, and `topLeft` already keeps the popup's left edge at the bell's left edge (≥0).

For the phone, the popup width is `min(320px, calc(100vw - 32px))`. Centered on a bell near the middle of a 375px bar, that can still overflow by a few px depending on where the bell lands. So the phone host also gets a CSS rule that pins the popup horizontally to the viewport: `left: 16px !important`, scoped to the bottom-nav popup class via `rootClassName`. This is safe because the bottom nav is `position: fixed` with `left: 0`, so the container's coordinates are the viewport's. The rule lives in `App.css`'s `@media (max-width: 767px)` block.

*Alternatives:*
- Computing placement from `window.innerWidth`. Rejected: no JS width checks.
- `document.body` container. Rejected: CLAUDE.md rule and scroll glitches.
- Phone Drawer instead of a dropdown. Rejected as scope creep: it would be a second notifications UI to keep in sync.

### 1a. Sidebar bell turns off `autoAdjustOverflow` (found during apply)

antd measures overflow against the popup container. In the 64px rail, that is the sidebar, so a 320px popup "overflows" it, and antd flips `topLeft` to right-aligned, which put the popup 272px off the left edge. Opening up and to the right from the bottom-left always fits the viewport, so the sidebar host passes `autoAdjustOverflow={false}`. The phone host keeps the default, and no CSS pin was needed there: `top` stays on-screen at 320px and 375px.

### 1b. Rail footer is a 2-column icon grid (found during apply, user-approved)

In both rail modes, the footer's icon row (bell, theme, plus the collapse toggle on desktop) was wider than the rail: 104px collapsed and 68px on tablet, against about 40px of real inner width. The `.sidebar-footer` inline padding beat the rail rule's `padding: 8px 4px`. So the row spilled left, and the bell sat at x≈-20px. Stacking the icons vertically fixed that but broke the height budget on browse pages at 768px tall (+46px collapsed, +10px tablet).

Instead:
- The footer's inline styles moved into `App.css` classes.
- In the rail, `.sidebar-footer` is a `grid-template-columns: repeat(2, 30px)` grid. `.sidebar-footer-icons` is `display: contents`, so on browse pages the Filters button joins the icons: [Filters, Bell] [Theme, Toggle], 2 rows like before. The divider and user row span both columns.
- The buttons are 30px, not 32px, because the rail's 1px border leaves 63px of content.

Measured: the sidebar is still exactly 768/768 at 1366×768 collapsed and 800×768 tablet, on browse and non-browse pages, and every footer button sits within 0–63px. The full desktop sidebar is unchanged.

### 2. Phone Filters control lives in `BottomNav`

`App.tsx` passes the same three props it gives `Sidebar` (`isBrowsePage`, `showFilterPanel`, `onToggleFilterPanel`) to `BottomNav`. On browse pages only, `BottomNav` renders a `FilterOutlined` icon button after Watchlist:
- `aria-label="Toggle filters"` and `aria-expanded`, matching the sidebar button.
- Gold (`RATING_GOLD`) while the panel is open, the same active-color convention the bottom nav already uses.
- `useFlashTooltip` behavior like its sibling icons.

That makes 7 buttons on browse pages. At 375px that is about 53px per slot, which is above the 44px touch-target minimum. Below 360px, the existing padding rule already shrinks the buttons.

*Alternative:* a floating action button over the browse grid. Rejected: it would overlap poster cards and the infinite-scroll sentinel, and it is another fixed element to theme in light and dark. The bottom nav is already where phone navigation controls live.

### 3. Icon: gold "C" monogram on dark, SVG source with outlined glyph

The source is `public/icon.svg`: a 512×512 rounded square in `#0d0f1a` (the manifest's `theme_color`) with a bold "C" in `RATING_GOLD`. This is the same mark as the sidebar's compact logo (`.sidebar-logo-compact`). A full "CINE DB" wordmark is unreadable at 16–32px, so the monogram is used at every size. The glyph is stored as an outlined `<path>` (Poppins 700, converted once), so rendering doesn't depend on any installed font.

Raster files are generated once during apply:
- Playwright (`playwright-core`, already a devDependency) screenshots the SVG at 512 and 192.
- Pillow (in the Django env) builds `favicon.ico` with 16/24/32/64 frames, the sizes `manifest.json` declares.

The generator is a scratch `verify_*`-style script that is deleted afterwards (CLAUDE.md: no scratch scripts in the tree). Only the SVG and the outputs are committed. To regenerate, repeat the same two steps. `docs/ARCHITECTURE.md` gets one line that records this.

*Alternative:* hand-drawing the icon in Pillow. Rejected: no vector source to regenerate from.

### 4. `web-vitals` removal

Run `npm uninstall web-vitals`, which updates `package.json` and `package-lock.json` together. First grep `src/` and `e2e/` to confirm nothing imports it.

## Risks / Trade-offs

- [antd may ignore `placement` once `autoAdjustOverflow` flips it against the fixed or sticky container] → Re-measure `getBoundingClientRect()` of `.ant-dropdown` at 1366, 800 and 375px with the desktop sidebar both expanded and collapsed. If a host still overflows, apply the same scoped CSS pin used on phones to that host.
- [The `!important` left pin on phones fights antd's inline `left`] → It's scoped to one `rootClassName` and one breakpoint, and the popup's vertical position still comes from antd.
- [A 7th bottom-nav icon crowds very narrow phones (320px)] → The existing `<360px` padding rule applies. Check at 320px that no button wraps or overflows.
- [The new icon looks off on a light browser tab] → The dark rounded-square background keeps contrast on both tab themes.
