## Context

See proposal.md for the findings (backlog item 61). The current state that matters:

- `ProfileModal` holds itself while busy: the body reports `onBusyChange`, and the outer Modal turns off `keyboard`, `maskClosable`, `closable` and `onCancel`. `busy` covers only the body's own saves.
- The import dialogs (`CSVUploadModal`, `CSVImportAllModal`) render inside the body and hold only themselves. `rc-dialog` stops an Escape keydown's propagation only when its own `keyboard` is on, so a held child lets Escape bubble through the React portal tree to the outer Modal.
- `useAppContext` exposes `toggleWatchlist` (`watchlist.toggle`), used only by the two detail pages. `useWatchlistContext()` has `add`/`remove`.
- File parsing in each import dialog runs per pick with no tie to the latest pick.

## Goals / Non-Goals

**Goals:**
- Fix the ten findings of item 61, each with a Jest test.

**Non-Goals:**
- Lifting the Mark as Watched dialog to one per grid. That is a bigger change to the grids' props, and lazy mounting gets most of the saving.
- Changing the import dialogs' layout or their results display.

## Decisions

**1. Child imports report busy to Edit Profile.**
- `CSVUploadModal` and `CSVImportAllModal` take an optional `onBusyChange(busy)` and call it from an effect on `loading`, with cleanup reporting `false`, the same pattern as `ProfileModalBody`.
- The body folds both into its `busy` (`importBusy` state), so the outer Modal holds through its existing props.
- `CSVListImportModal` isn't opened from Edit Profile and only gains the prop if a caller needs it.
- Rejected: stopping Escape propagation in the child's wrapper. It patches one key and leaves a click on the outer mask, which sits under the child's mask, as a possible close path. Reusing `busy` closes every path at once.

**2. Explicit watchlist actions on detail pages.**
- The click handler captures `inWatchlist` from the render. It calls `remove(id, type)` when that was true and `add({...})` otherwise, and words the toast from the same captured value.
- `toggleWatchlist` is removed from `useAppContext` and `types/context.ts`. `watchlist.toggle` itself stays in the hook, since other code and tests may use it. Check with grep and remove it only if unused.

**3. Episode bounds.**
- `getMaxEpisodes(season)` returns `number | null`, and `null` means unknown: no season entry, a missing count, or 0.
- The editor caps `+` only for a number and shows `/n` only then.
- "Next Episode" moves to the next season unless that season is listed with `episode_count` 0. A season that is missing from `seasons`, or has no count, is still offered, as before.

**4. Unexpected import failure.** `CSVImportAllModal`'s catch shows `showError(getApiError(err, "Import failed. Please try again."))` instead of rethrowing. This matches the other two dialogs. `SessionEndedError` stays silent.

**5. Latest pick only.**
- Each dialog keeps a `pickRef` counter that each `handleFileChange` increments. A parse result is applied only when its captured id still equals `pickRef.current`.
- For `FileReader` the check goes inside `onload`/`onerror`; for the zip, after each `await`.
- The `<input type="file">` gets `disabled={loading}`.

**6. Landmarks.** `Movies.tsx` and `TVShows.tsx` change `<main aria-label>` to `<section aria-label>`. A labelled section is a `region` landmark, so the label is kept.

**7. Repeated announcement.**
- When the settled title equals the text already in the live region, `announce()` clears the region and sets the title again after `REANNOUNCE_GAP_MS` (100 ms), on the same timer the settle delay uses, so the next navigation cancels it.
- A different title is set straight away, as before, so every other announcement keeps its timing.
- Rejected: keying the region element. A remounted live region isn't reliably announced by screen readers, while a text change inside a stable region is.
- Rejected: a `requestAnimationFrame` refill. A short timer is simpler, works the same under Jest's fake timers, and a frame can be too short for some screen readers to notice the cleared text.

**8. Font load re-measure.** `MarqueeTitle`'s layout effect also runs `measure` after `document.fonts?.ready` resolves, guarded by a `cancelled` flag in cleanup. Browsers without `document.fonts`, and jsdom, skip it.

**9. Template CSV.** `CSVListImportModal`'s template uses `downloadCSV(templateRows(type).map(({ id, title }) => ({ id, title })), filename)`. `templateRows` is exported from `CSVUploadModal.tsx` already. The list import reads only `id` and `title`, so the template keeps those two columns (spec: templates list only imported columns).

**10. Lazy Mark as Watched.**
- `MediaCard` keeps a `markWatchedMounted` flag, set when the dialog first opens, and renders `MarkWatchedModal` only from then on.
- Once mounted it stays mounted, so the close animation still plays and a reopen is instant.

## Risks / Trade-offs

- [Removing `toggleWatchlist` breaks a test or e2e that mocks it] → Grep `src`, `e2e` and the tests, and update the mocks in the same task.
- [The rAF-based announce changes timing in `RouteAnnouncer` tests] → Tests use fake timers or wait for the text; update them to wait for the final message.
- [An unknown episode count lets a user save an episode past the season's real end] → Same as today for missing seasons (cap 99). The server accepts any positive episode.
