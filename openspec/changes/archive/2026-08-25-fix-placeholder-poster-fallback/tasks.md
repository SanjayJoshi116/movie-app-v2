## 1. Poster placeholder conformance

- [x] 1.1 In `src/pages/SearchPage.tsx`, replace the `https://placehold.co/500x750?text=No+Image` fallback in the movie-results `<img>` with `<PosterPlaceholder className="movie-poster-img" />`
- [x] 1.2 In `src/pages/SearchPage.tsx`, replace the `https://placehold.co/500x750?text=No+Image` fallback in the TV-results `<img>` with `<PosterPlaceholder className="movie-poster-img" />`
- [x] 1.3 In `src/pages/RecommendationsPage.tsx`'s `RecCard`, replace the `https://placehold.co/500x750?text=No+Image` fallback with `<PosterPlaceholder className="movie-poster-img" />`

## 2. Verification

- [x] 2.1 Run `npx tsc --noEmit`
- [x] 2.2 Run `npx eslint src --ext .ts,.tsx` and confirm no new warnings
- [x] 2.3 Manually verify in the browser: search for a title with no poster and confirm the Search page (movie and TV tabs) renders the themed "No Image" placeholder, not a broken image or external placeholder; do the same check on the Recommendations page if a no-poster item appears there
