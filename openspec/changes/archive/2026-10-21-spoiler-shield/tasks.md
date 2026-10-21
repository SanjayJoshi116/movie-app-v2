## 1. Shield rule

- [x] 1.1 Add `src/utils/spoilerShield.ts` with `isEpisodeHidden(season, episode, progress)` (strictly after the tracked episode, season 0 never) and `shieldApplies({ enabled, watched, progress })`
- [x] 1.2 Jest tests for both: same-season later/earlier/equal episode, later/earlier season, specials, null progress, watched, preference off

## 2. Episode Guide

- [x] 2.1 Add `progress`, `progressLoading`, `progressError` and `watched` props to `EpisodeGuide.tsx`; show the existing skeleton and start no season fetch while `progressLoading`
- [x] 2.2 Replace the mount effect with a ref-guarded "first settle" effect that picks the tracked season when the show has it, else the first regular season, and never re-selects after that (StrictMode-safe)
- [x] 2.3 Add the `useLocalStorage("cinedb_spoiler_shield", true)` preference and a labelled "Hide spoilers" `Switch` in the header row, rendered only when the shield can apply
- [x] 2.4 Render hidden episodes: label keeps `E<n>`, air date, runtime and score with "Hidden to avoid spoilers" instead of the title; body shows a token-colored placeholder (no `<img>`) and a "Show details for episode <n>" button
- [x] 2.5 Keep revealed episode ids in a `Set` in component state so a reveal survives season switches and affects only that episode
- [x] 2.6 On `progressError`, render unshielded with the secondary note that spoilers aren't hidden because progress couldn't be loaded
- [x] 2.7 Pass `epProgress`, `epLoading`, `epError` and `watched` from `TVShowDetails.tsx`

## 3. Tests

- [x] 3.1 Jest `EpisodeGuide` tests: hidden title and overview absent from the DOM and no still `<img>`; reveal one episode only; reveal survives a season switch; switch off shows all and persists to `localStorage`; no switch without progress; watched show unshielded; skeleton while progress loads with no season fetch; error note; opens on tracked season; progress change doesn't switch the viewed season
- [x] 3.2 Python e2e in `e2e/python/test_detail.py`: mock episode progress at S1E1 for the mock show, check a later episode's title is hidden and appears after "Show details"; confirm the existing guide tests (no progress) still pass

## 4. Docs and verification

- [x] 4.1 README "Episode Guide" feature line: spoiler shield, reveal, switch; `docs/ARCHITECTURE.md` bullet on why hidden content is absent (not blurred) and why the guide waits for progress
- [x] 4.2 Add the idea's status to `ideas.md` (item 1 proposed as `spoiler-shield`)
- [x] 4.3 Run `npm run typecheck`, `npm run lint`, the Jest suite, and the touched e2e test file
- [x] 4.4 Check it in the real app with `npm run dev` and Playwright: track a show mid-season, confirm later titles hidden, reveal, switch, both themes and phone width
