export const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

export const IMG_URL = "https://image.tmdb.org/t/p/w500";

/** Grid poster cards (shown ~150-220 px wide): about half the bytes of w500. */
export const POSTER_URL = "https://image.tmdb.org/t/p/w342";

export const POSTER_THUMB_URL = "https://image.tmdb.org/t/p/w185";

export const STILL_URL = "https://image.tmdb.org/t/p/w300";

export const LOGO_URL = "https://image.tmdb.org/t/p/w92";

/** Hero and detail-page backdrops; `original` is often 3840 px and several MB. */
export const BACKDROP_URL = "https://image.tmdb.org/t/p/w1280";

/** Full resolution, only for the full-screen image preview. */
export const BACKDROP_ORIGINAL_URL = "https://image.tmdb.org/t/p/original";

/** YouTube trailer thumbnail (`TrailerEmbed`); its host is in the nginx CSP img-src. */
export const YT_THUMB_URL = (key: string) => `https://i.ytimg.com/vi/${key}/hqdefault.jpg`;

export const RATING_GOLD = "#f5c518";
export const WATCHED_GREEN = "#52c41a";
export const RATING_WARN = "#faad14";
export const RATING_BAD = "#ff4d4f";
