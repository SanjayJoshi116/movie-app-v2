export const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

export const IMG_URL = "https://image.tmdb.org/t/p/w500";

export const BACKDROP_URL = "https://image.tmdb.org/t/p/original";

export const NO_IMAGE = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='450'%3E%3Crect width='300' height='450' fill='%231a1a2e'/%3E%3Ctext x='150' y='225' text-anchor='middle' dominant-baseline='middle' fill='%23555' font-size='14' font-family='sans-serif'%3ENo Image%3C/text%3E%3C/svg%3E`;

export const RATING_GOLD = "#f5c518";
export const WATCHED_GREEN = "#52c41a";
