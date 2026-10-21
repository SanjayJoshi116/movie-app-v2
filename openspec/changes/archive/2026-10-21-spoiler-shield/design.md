## Context

`EpisodeGuide.tsx` loads one season at a time (`fetchTVSeason`, a per-season ref cache, a `requestedSeason` guard against stale responses). Each episode is a `Collapse` item: the label always shows `E<n>`, the title, air date, runtime and score, and the body (still + overview) renders only when the episode is expanded. The guide always starts on the first regular season and fetches it from a mount effect.

`TVShowDetails.tsx` already holds everything the shield needs: `useEpisodeProgress(tvShow.id)` gives `progress` (`{ season, episode }` or `null`), `loading` and `error`, and `isWatched(tvShow.id, "tv")` from `WatchedContext`. The guide sits inside an outer "Episode Guide" `Collapse` that is open by default.

Requirements are in `specs/spoiler-shield/spec.md`. Motivation is in proposal.md.

## Goals / Non-Goals

**Goals:**
- One pure rule decides whether an episode is hidden, so it is testable without rendering.
- Hidden content is never in the DOM, so there is no CSS blur that a screen reader or a slow stylesheet could leak.
- No new request. The shield only removes content; it never fetches anything.

**Non-Goals:**
- Hiding spoilers anywhere outside the Episode Guide: the show overview, cast "character" names, reviews, images, recommendations. Those aren't tied to an episode position.
- Per-episode watched state. The shield reads the single progress pointer that exists today.
- Hiding specials (season 0): they have no place in the progress order.
- Remembering which episodes were revealed beyond the current page visit.
- A per-account (server-side) preference.

## Decisions

### 1. The tracked episode counts as reached
"Currently on S02E04" is shown both after Track (S1E1 before watching anything) and after Next Episode (moving on to the next one to watch). Either way, the user is about to watch or is watching that episode, so its title and overview are the kind of teaser they'd expect. Episodes strictly after it are hidden: `season > p.season || (season === p.season && episode > p.episode)`, with `season === 0` never hidden.

- Alternative: hide the tracked episode too. Rejected. Right after Track, the guide would hide S1E1, the one episode the user is certainly about to watch.

### 2. The shield applies only with progress, without watched, with the preference on
`shieldActive = preference && !watched && progress != null`. A show marked watched is finished, so there is nothing left to spoil. A show without progress has no position to measure from: hiding everything would punish users who don't track progress.

### 3. The guide waits for progress, and an error unshields with a note
`EpisodeGuide` takes new props: `progress`, `progressLoading`, `progressError`, `watched`. While `progressLoading` is true, it shows its existing skeleton and does not start the first season fetch. Showing episodes first and then hiding them would flash the very spoilers this exists to prevent.

On `progressError`, the guide renders unshielded with a one-line secondary note ("Couldn't load your progress, so spoilers aren't hidden."). This matches the app's honest-states rule (the tracker shows its own error with Retry above). Hiding everything instead would block the whole guide on a failed side request.

### 4. The first season is chosen once progress settles
The mount effect becomes "first time `progressLoading` is false": pick `progress.season` if it is in the show's season list, else the first regular season, and load it. A ref records that the initial season was chosen, so later progress changes (Next Episode, Edit) only re-run the shield rule. They never move the season the user is looking at.

StrictMode replays effects, so the choice goes in a ref-guarded effect, not a `useState` initializer: the initializer runs before progress is known.

### 5. Hidden episodes render a placeholder, and reveal is per page visit
For a hidden episode:
- **label:** `E<n>`, "Hidden to avoid spoilers" (secondary text), and the air date, runtime and score tags as today;
- **body:** a `PosterPlaceholder`-style box sized like the still, plus a link button "Show details for episode <n>".

The `<img>` is not rendered, so the still is never requested. Revealed episodes are a `Set` of TMDB episode ids in component state, which survives season switches (the season cache already survives them) and resets when the page remounts (`App.tsx` keys routes on the pathname).

- Alternative: CSS `filter: blur()` on the real content. Rejected: the text stays in the accessibility tree and the still is downloaded anyway.

### 6. Preference via `useLocalStorage("cinedb_spoiler_shield", true)`
Same hook and key prefix as `cinedb_theme` and `cinedb_sidebar_collapsed`. The hook's same-tab change event keeps two mounted guides in agreement, though only one is mounted today. It's a device preference, so it isn't reset on sign-out.

The switch is an antd `Switch` with a visible "Hide spoilers" label, shown in the guide's header row next to the season `Select`, only when the shield could apply (progress loaded and present, show not watched).

### 7. Colors and type follow the existing conventions
The placeholder takes `colorFillSecondary` through `theme.useToken()`, like `PosterPlaceholder`. Text sizes use `FONT_SIZE`. No new color literal.

## Risks / Trade-offs

- [The progress pointer is approximate: a user who watched ahead without updating it sees later episodes hidden.] → One tap reveals an episode, and the switch turns the shield off.
- [The guide now waits for the progress request before its first season fetch, adding one round trip to first paint.] → Both requests start on page load and progress is a small, local DB read. The first season still loads in parallel with everything else on the page once progress settles. Accepted to avoid the spoiler flash.
- [Episode titles also appear outside the guide (e.g. a TMDB `next_episode_to_air` name, if shown later).] → Out of scope; any future surface that names an upcoming episode should reuse the same rule function.
- [A signed-out view, if TV pages ever allow one, has no progress.] → `progress` is null, so nothing is hidden, which is correct.
