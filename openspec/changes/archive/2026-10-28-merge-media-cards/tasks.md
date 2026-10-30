## 1. Adapter

- [x] 1.1 Add `src/utils/mediaSummary.ts`: `MediaSummary` type and `toMediaSummary` with `"movie"` and `"tv"` overloads (design decision 1)
- [x] 1.2 Jest test `src/utils/__tests__/mediaSummary.test.ts`: movie maps `title`, TV maps `name`, `posterPath` keeps `null`, `type` is the one passed

## 2. Card

- [x] 2.1 Add `src/components/MediaCard.tsx` from `Movie.tsx`'s markup, with flat props `{ id, type, title, posterPath, voteAverage, onKnowMore }` (decisions 2 and 3), the type literal from props, link `/${type}/${id}`, every class name and label string unchanged (decision 4), exported through `memo`
- [x] 2.2 Jest test `src/components/__tests__/MediaCard.test.tsx` rendering a movie and a TV item: poster link `href`, watched/watchlist/Details aria-labels name the title, Mark as watched opens `MarkWatchedModal` with the right `mediaType`, `PosterPlaceholder` when `posterPath` is null

## 3. Callers

- [x] 3.1 `Movies.tsx` and `TVShows.tsx` render `<MediaCard {...toMediaSummary(item, type)} onKnowMore={onKnowMore} />`, dropping `Movies`' per-item closure
- [x] 3.2 `SearchPage.tsx` Movies and TV tabs render `MediaCard` the same way
- [x] 3.3 Delete `src/components/Movie.tsx` and `src/components/TVShowCard.tsx`; `grep` confirms no imports remain

## 4. Docs

- [x] 4.1 README component tree and CLAUDE.md mentions of `Movie.tsx`/`TVShowCard.tsx` point at `MediaCard.tsx` (and `toMediaSummary` for title/name)

## 5. Verify

- [x] 5.1 `npm run typecheck`, `npm run lint`, Jest suite pass
- [x] 5.2 E2E for the touched cards only: `npx playwright test e2e/movies.spec.ts e2e/detail-and-nav.spec.ts e2e/search-scope.spec.ts e2e/search-url.spec.ts e2e/browse-restore.spec.ts` and `pytest e2e/python/test_browse.py e2e/python/test_search.py`
