## Why

Backlog item 37 (sixth audit), plus the light-theme contrast finding open since the third audit. The app is keyboard-reachable and labelled (`a11y-routing`, `honest-states-a11y`), but several gaps remain for users of assistive tech, motion-sensitive users and touch users:

- **No reduced-motion support anywhere.** Page transitions, card hover lift/scale, the sidebar spring, the Stats count-up and the title marquee all animate whatever the OS setting.
- **Every route is titled "CINE DB".** Tabs, history and bookmarks can't be told apart, and screen readers get no cue that the page changed (WCAG 2.4.2).
- **Library card buttons don't name their title** (Watchlist, Watched, list pages), against the project's own card rule: every card reads "Remove from watchlist".
- **Navigation entries aren't links.** The sidebar and bottom nav navigate in click handlers: no Ctrl/middle-click into a new tab, no link semantics.
- **Profile password fields have no `autoComplete`,** so password managers fill or save the wrong field.
- **The Mark as Watched dialog can be closed mid-save** and closes even when the save failed, losing the typed runtime and platform.
- **Long card titles are readable only by mouse hover** (clipped, no ellipsis, scroll on hover only).
- **Light-theme secondary text is below WCAG AA** (`#8c8168` is 3.48–3.82:1); the tertiary text antd derives is about 3.3:1. The readability test only asks for 3:1.

## What Changes

- Motion follows the OS "reduce motion" setting: framer-motion animations, CSS transitions/animations, the count-up (shows the final number) and the marquee (doesn't scroll).
- Each route sets a document title ("Watchlist · CINE DB"; detail and person pages use the title's or person's name), and a polite live region announces the new title after navigation.
- Library card action buttons include the title in their accessible name.
- Sidebar and bottom-nav entries are real links (plain click still routes in-app; modifier clicks open a new tab).
- Profile password fields declare `current-password` / `new-password`.
- Mark as Watched keeps the dialog open, uncloseable, with a loading button while saving; a failed save leaves it open with the input; only success closes it.
- Long card titles end in an ellipsis with the full title available (`title` attribute), re-measured on resize; the hover marquee stays for mouse users who allow motion.
- Light-theme secondary and tertiary text meet 4.5:1 on every light background; the readability test asks for 4.5:1 for text.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `accessibility`: reduced motion; page titles and announced navigation; card action buttons name their title; navigation entries are links; password fields declare their purpose; truncated titles stay readable.
- `theme-readability`: secondary and tertiary text meet AA contrast in both themes.
- `mark-watched`: the dialog holds while saving and survives a failed save.

## Impact

- Frontend: `index.tsx`/`App.tsx` (`MotionConfig`, title announcer), new `usePageTitle` hook used by every page, `App.css` (reduced-motion media query), `StatsPage.tsx` (count-up), `MarqueeTitle.tsx`, `Sidebar.tsx`, `BottomNav.tsx`, `WatchlistPage.tsx`, `WatchedPage.tsx`, `ListDetailPage.tsx`, `ProfileModal.tsx`, `MarkWatchedModal.tsx` and its six callers, `theme/antdTheme.ts`.
- Tests: Jest (title hook, marquee, mark-watched busy/failure, count-up under reduced motion), e2e (`theme-readability.spec.ts` threshold, accessibility checks for titles, nav links, card button names, reduced motion via `reducedMotion: "reduce"`).
- Docs: CLAUDE.md (page titles, reduced motion, nav links, contrast floor), README, `docs/BUG_BACKLOG.md`.
- No backend change.
