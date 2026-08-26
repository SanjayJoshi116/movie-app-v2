## 1. Shared constants

- [x] 1.1 Add `POSTER_THUMB_URL = "https://image.tmdb.org/t/p/w185"` to `src/constants/ui.ts`

## 2. Poster placeholder conformance

- [x] 2.1 In `src/components/Movie.tsx`, replace the `https://placehold.co/500x750?text=No+Image` fallback with `<PosterPlaceholder className="movie-poster-img" />`
- [x] 2.2 In `src/components/TVShowCard.tsx`, replace the `https://placehold.co/500x750?text=No+Image` fallback with `<PosterPlaceholder className="movie-poster-img" />`
- [x] 2.3 In `src/pages/HomePage.tsx`'s Recently Watched strip, replace the `https://placehold.co/72x108?text=?` fallback with `<PosterPlaceholder style={{ width: 72, height: 108, borderRadius: 6 }} />`, and replace the hardcoded `https://image.tmdb.org/t/p/w185` with the new `POSTER_THUMB_URL` constant

## 3. Constant/duplication cleanup

- [x] 3.1 In `src/components/HeroBanner.tsx`, remove the locally redeclared `BACKDROP_URL` and import it from `src/constants/ui.ts` instead
- [x] 3.2 In `src/components/layout/FilterPanel.tsx`, replace the hardcoded `#f5c518` genre-tag border color with the shared `RATING_GOLD` constant from `src/constants/ui.ts`

## 4. UI consistency

- [x] 4.1 Add `aria-label="Movie results"` to `src/components/Movies.tsx`'s results `<main>` to match `TVShows.tsx`'s `aria-label="TV show results"`

## 5. Verification

- [x] 5.1 Run `npx tsc --noEmit`
- [x] 5.2 Run `npx eslint src --ext .ts,.tsx` and confirm no new warnings
- [x] 5.3 Manually verify in the browser: a title with no poster on `/movies` and `/tv` renders the themed "No Image" placeholder (not a broken image / external placeholder), and the Recently Watched strip still renders correctly for both movies and TV
