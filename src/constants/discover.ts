// Minimum TMDB vote counts for the browse sorts other than Popularity
// (filtersToTMDBParams). Without them TMDB's discover leads with junk: a
// 10.0 title with one vote, unvoted uploads dated today, 1870s shorts and
// punctuation-named titles. Measured on live TMDB (fix-browse-results);
// backend/userdata/tests/test_tmdb_live.py checks them and fails if its copy
// differs from these.
export const RATING_SORT_MIN_VOTES = 300;
export const NEWEST_SORT_MIN_VOTES = 10;
export const OLDEST_SORT_MIN_VOTES = 100;
export const TITLE_SORT_MIN_VOTES = 100;
