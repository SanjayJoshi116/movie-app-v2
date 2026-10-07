/**
 * Merge restore info into the *current* history entry's router state, so the
 * browser's own Back button lands on an entry that says `isReturn: true` —
 * the same state the in-app Back button passes explicitly.
 *
 * This deliberately bypasses `navigate(..., { replace: true })`: a raw
 * `replaceState` emits no event, so React Router doesn't re-render the page
 * on its way out. On the later `popstate`, React Router rebuilds
 * `location.state` from `history.state.usr` (see `createBrowserHistory` in
 * `@remix-run/router`), keyed alongside its own `key`/`idx`, which are kept.
 * If a router upgrade renames `usr`, the browse Back e2e test fails — switch
 * this body to a replace-navigate then.
 */
export function stashReturnState(state: Record<string, unknown>): void {
  const cur = (window.history.state ?? {}) as { usr?: Record<string, unknown> | null };
  window.history.replaceState({ ...cur, usr: { ...(cur.usr ?? {}), ...state } }, "");
}
