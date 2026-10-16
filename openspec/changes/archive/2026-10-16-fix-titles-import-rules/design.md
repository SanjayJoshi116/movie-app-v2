## Context

See proposal.md for the findings. Relevant current state:

- `usePageTitle(name, { loading })` sets `document.title` and notifies `RouteAnnouncer` from an effect. React runs child effects before parent effects, so when `MovieDetailPage` (and `TVDetailPage`, `PersonPage`) render `<NotFoundPage />` for an invalid id, the parent's call (`"Movie"`, `loading: false`) runs last and wins.
- The same pages pass `movie?.title ?? "Movie"`, so a settled 404 or failure keeps the generic name while the page renders `LoadError` with its own heading.
- `WatchlistPage` applies the Watched/Unwatched `extraFilter` through `isWatched` whatever the watched history's state; `filterReady` only gates the page clamp (by design, per the `library-filters` spec).
- `lookupImportPosters(rows, onProgress, shouldStop)` looks up every row it's given. `CSVUploadModal` filters rows lacking a poster or score and remaps results by index; `CSVImportAllModal.enrichPosterPaths` filters on poster only and mutates rows; `CSVListImportModal` passes every row and overwrites the file's values with `found[i] ?? null/0`.
- `parseCSVForImport` bounds `poster_path` (leading `/`, ≤ 500) and range-checks `vote_average`; `parseBackupCSV` does neither (`parseFloat(...) || 0`, any poster string).

## Goals / Non-Goals

**Goals:**
- The page that owns the route owns its title in every state, so ordering between nested `usePageTitle` calls doesn't matter.
- One function decides which import rows need a lookup and how file values merge with lookup values.
- One parser rule per CSV column across both CSV readers.

**Non-Goals:**
- Making `usePageTitle` a stack of nested owners (no current nested caller needs it; see proposal "Not changed").
- Changing what the Watchlist clamp waits for (the spec already says it doesn't run on failed data).
- Changing the import result messages or `missingPostersNote`.

## Decisions

### 1. Detail pages compute their title from their own state
Each detail/person page derives one `name` from its state: `id === null` → `"Page Not Found"`, `error === "not-found"` → its not-found heading, `error === "failed"` → its error heading, else the loaded name or the generic one, with `loading` true only while a valid id is loading. The headings move into constants shared by the `LoadError` render and the title, so they can't drift. `NotFoundPage` keeps its own `usePageTitle("Page Not Found")` (it's also the catch-all route); under a detail page both calls now say the same thing, so their order is irrelevant.

*Alternative:* skip the parent's call when `id === null`. Hooks can't be called conditionally, and an "inactive" flag on `usePageTitle` would add a mode to shared infrastructure for one case. Rejected.

### 2. Watchlist renders `LoadError` when its filter's data failed
In the render chain, after the watchlist's own loading/error/empty branches and before the filtered-empty branch: if `watchedFilter !== "all"` and the watched history has `error`, show `<LoadError title="Couldn't load your watched history" onRetry={reloadWatched} />` (the `WatchedContext.reload`, errors swallowed like the watchlist's Retry). The filter bar stays visible so the user can switch to "All". `filterReady` stays as is.

### 3. `lookupImportPosters` takes rows that may already carry values
Rows become `{ mediaId, type, posterPath?, voteAverage? }`. It looks up only rows missing a poster or a score, and returns `found[i]` per input row, already merged: the file's `posterPath`/`voteAverage` first, then the lookup's. A covered row's `found[i]` is its own values, with no request. `missing` counts rows whose final poster is null. Callers map their rows in, read `found[i]` out, and drop their own filtering and remapping:
- `CSVUploadModal`: passes `posterPath`/`voteAverage` from `ParsedEntry`.
- `CSVListImportModal`: same; its `?? null` / `?? 0` defaults stay for rows nothing filled.
- `CSVImportAllModal.enrichPosterPaths`: passes `posterPath` and `voteAverage`; since backup rows always carry a number score, a row is looked up exactly when its poster is missing, as today. It writes back `posterPath` only (the backup's score stays authoritative).

*Alternative:* a separate `lookupMissingPosters` wrapper next to it. Every caller would use the wrapper, leaving the bare function unused. Rejected.

### 4. Shared column parsers in `csvParse.ts`
`parseScore(raw): number | undefined` (finite, 0–10) and `parsePosterPath(raw): string | undefined` (leading `/`, ≤ `MAX_POSTER_PATH_LENGTH`) next to `parsePositiveInt`. `parseCSVForImport` uses both as it does inline today. `parseBackupCSV` uses `parseScore(...) ?? 0` (keeps its number type and today's fallback) and `parsePosterPath(...) ?? null`, so a dropped poster is looked up by the restore like any missing one.

## Risks / Trade-offs

- [Error-heading titles are long ("Failed to load TV show details · CINE DB")] → They match what's on screen, which is the point; tab truncation is acceptable.
- [Backup rows with a missing `vote_average` column still count as "score given" (0)] → Unchanged from today and only affects hand-made files; v1+ backups always write the column.
- [Changing `lookupImportPosters`' contract touches three dialogs at once] → Each dialog's existing Jest tests plus new cases for the list import and backup restore cover the merge.
