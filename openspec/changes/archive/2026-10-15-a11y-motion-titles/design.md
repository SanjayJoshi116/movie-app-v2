## Context

See proposal.md for why. Today:

- framer-motion drives page transitions (`pageVariants`), card `whileHover` lift/scale, and the sidebar's spring entrance; nothing wraps the tree in a `MotionConfig`. `App.css` has its own transitions. `StatsPage.tsx` `useCountUp` animates numbers with `requestAnimationFrame`. `MarqueeTitle.tsx` clips without ellipsis and scrolls on `mouseenter`, measuring once per title.
- `public/index.html` sets `<title>CINE DB</title>`; nothing changes it.
- `LibraryItemCard` callers pass action buttons labelled "Mark watched", "Rate", "Remove from watchlist", "Remove from list", "Mark as unwatched".
- `Sidebar.tsx` navigates in `Menu.onSelect`; `BottomNav.tsx` uses antd `Button`s with `onClick={navigate}` and `<button>`s in the More drawer. `CardLink.tsx` exports `isPlainClick()`, already used by the hero's "View Details" `Button href`.
- `ProfileModal.tsx`'s three password inputs and the Danger Zone password have no `autoComplete`.
- `MarkWatchedModal` calls `onConfirm(details)` and returns; its six callers (`Movie`, `TVShowCard`, `MovieDetails`, `TVShowDetails`, `RecommendationsPage`, `WatchlistPage`) await the toggle, toast, then close, success or not. `RatingModal` already has the hold-while-saving contract.
- `antdTheme.ts` light: `colorTextSecondary #8c8168` on `#f8f3e8` / `#fffdf8` / `#fffefb` (layout, container, elevated); no `colorTextTertiary`, so antd derives one. Dark: `colorTextSecondary #a0a0b8`, tertiary derived. `e2e/theme-readability.spec.ts` asserts `TEXT_MIN = 3`.

## Goals / Non-Goals

**Goals:** honour reduced motion app-wide; distinguishable, announced pages; every listed control usable by keyboard, screen reader, password manager and touch; AA text contrast.

**Non-Goals:** moving focus to a heading on navigation (it would fight the scroll restores in `usePaginatedFetch` and the library pages; a live announcement gives the cue without that); an in-app motion toggle; changing dark-theme primary colors; auditing every antd component's internal contrast.

## Decisions

**1. One `MotionConfig reducedMotion="user"` plus one CSS media query.**
`index.tsx` wraps `<App>` in `<MotionConfig reducedMotion="user">`: framer-motion then skips transform and layout animations (hover lift/scale, the sidebar slide, page slides) when the OS asks, and keeps opacity fades instant enough. `App.css` gets `@media (prefers-reduced-motion: reduce)` that sets `animation-duration`, `animation-iteration-count` and `transition-duration` to minimal values on everything (antd's own animations included). `useCountUp` and `MarqueeTitle` read framer-motion's `useReducedMotion()` and skip their animation. *Alternative:* per-component checks everywhere (misses antd and future components).

**2. `usePageTitle(name)` + a route announcer.**
`src/hooks/usePageTitle.ts` sets `document.title` to `"<name> · CINE DB"` (or "CINE DB" with no name) and resets it on unmount. Every page calls it with a fixed name; detail and person pages pass the loaded name, a generic one ("Movie", "TV Show", "Person") until then. `src/components/RouteAnnouncer.tsx`, rendered once in `App`, is a visually hidden `role="status" aria-live="polite"` region: after a pathname change (not the first render) it waits for the title to settle (the last title set within ~1 s, so a detail page announces its name rather than "Movie") and writes it. No focus or scroll change. The hook stores the latest title in a tiny module-level subscription the announcer reads.

**3. Card buttons get the title.**
The five library-card labels become "<action>: <title>", matching `Movie.tsx`/`TVShowCard.tsx`.

**4. Nav entries as links without double navigation.**
Sidebar menu items get `label: <Link to={key}>` (the text is the link). `Menu.onClick` navigates only when the click didn't come from inside the anchor (icon or padding area), so a plain click pushes one history entry; the flash tooltip triggers either way. BottomNav core buttons become antd `Button href={path}` whose plain click is taken over with `isPlainClick()` (preventDefault + `navigate`), like the hero's "View Details"; More-drawer entries become `<Link>`s styled as before, closing the drawer on click.

**5. `autoComplete` on password fields.**
Profile "Current Password" and the Danger Zone password: `current-password`; "New Password" and "Confirm Password": `new-password`.

**6. Mark as Watched holds while saving.**
`onConfirm` becomes `(details) => Promise<void>` that rejects on failure (callers show their error, then rethrow), like `RatingModal`'s `onSave`. The modal keeps a `busy` flag: `confirmLoading`, Cancel disabled, `closable`/`maskClosable`/`keyboard` off, a repeat confirm ignored. It stays open on rejection; callers close it only after success. Form values survive because the modal isn't unmounted.

**7. `MarqueeTitle`: ellipsis, `title`, `ResizeObserver`.**
Resting style `text-overflow: ellipsis`; full title in `title`; a `ResizeObserver` re-measures; with reduced motion or no overflow, no scroll on hover.

**8. Contrast tokens.**
Pick light `colorTextSecondary` and an explicit `colorTextTertiary` that reach ≥ 4.5:1 on all three light backgrounds (the darkest, `#f8f3e8`, decides), keeping secondary darker than tertiary and the warm hue; measure the dark theme's secondary and derived tertiary on its three backgrounds and set an explicit tertiary (and secondary if needed) the same way. Values are computed and pinned in a Jest test from the theme config (WCAG relative-luminance formula), so a later tweak can't drop below. `theme-readability.spec.ts` raises its text floor to 4.5 (icons stay 3).

## Risks / Trade-offs

- [Darker secondary text changes the light theme's look] → same hue, smallest step that clears 4.5:1.
- [`reducedMotion="user"` keeps opacity animations] → they're short fades, not motion; the CSS rule shortens CSS ones too.
- [Announcer timing on slow detail loads] → it announces whatever is set ~1 s after navigation; a later name change updates the tab title but isn't announced twice.
- [Six callers change their `onConfirm` contract] → typed `Promise<void>`; a missed rethrow only means the dialog closes as today.

## Migration Plan

Frontend-only; ships with the next build.
