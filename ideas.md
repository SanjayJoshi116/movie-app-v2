# Ideas

Feature directions from four explore rounds (2026-10-19), with duplicates merged and the list ordered by priority. Each needs an OpenSpec change before work starts; a proposed item names its change.

Priority weighs value against effort and fit with the current architecture, and puts foundations ahead of the ideas that depend on them. Effort: S (small), M (medium), L (large).

## Facts these ideas build on

- `WatchedEntry`, `RatingEntry` and `WatchlistEntry` are `unique_together(user, media_id, media_type)`: one row per title, so no rewatches.
- `UserListItem` has no position: lists are unordered.
- `EpisodeProgress` is one pointer per show, with no air-date awareness.
- No relationships between users. "Follow" means TMDB people only.
- `src/api/tmdb.ts` sends no `language` param: all TMDB data is English.
- Movie details already append `release_dates` (`src/api/tmdb.ts:108`), so digital release dates are already fetched.
- `EpisodeGuide.tsx` hides episodes past your progress (0.30.0, `spoiler-shield`).
- Stats already counts watch platforms (`stats_views.py:136`).
- Movies and TV share one poster card, `MediaCard.tsx` (0.31.0), so a card change lands once (browse grids, Anime, Search).
- A user's TMDB `session_id` is encrypted at rest (0.31.0, `EncryptedSessionField`); read it through the model, never filter on it.
- No service worker, no scheduler in the Docker stack, no LLM, no live deployment yet.

---

## Top priority: module-by-module review sweep

Added 2026-10-30, ahead of every feature below. Run `/code-review high <paths>` on each module, and `/security-review` on the ones marked **high**. Unnumbered so the feature numbers (referenced from BUG_BACKLOG and CHANGELOG) stay put.

Step-by-step workflow (review → security → verify → propose → apply → simplify → review → archive): BUG_BACKLOG "Module sweep". Per module: paste BUG_BACKLOG's "Verified fine (don't re-audit)" entries into the prompt; log the findings as one backlog item per module (50, 51, …), marked unverified; verify each against the code before proposing; fix high and medium only. `/security-review` is built for pending changes, so either run it on a clean tree (a whole-tree pass, like 2026-10-26) or name the module's paths in its argument and check the report covers them.

Order: B1 → F1 → B3 → B2 → I1 → B7 → B4 → F2 → F3 → B6 → B5 → F4 → F5 (highest risk first; B6 late, reviewed 2026-10-28).

| # | Module | Paths | Lines | Security |
|---|---|---|---|---|
| B1 ✅ | Auth & account | `backend/userdata/auth_views.py serializers.py secret_fields.py tmdb_views.py` | ~1,230 | **high** |
| B2 ✅ | TMDB access | `backend/userdata/tmdb_proxy_views.py tmdb_client.py tmdb_budget.py timezones.py logging.py` | ~470 | **high** |
| B3 ✅ | Library CRUD | `backend/userdata/watchlist_views.py watched_views.py ratings_views.py lists_views.py bulk_import.py pagination.py views.py urls.py health_views.py` | ~740 | **high** |
| B4 | Social & notifications | `backend/userdata/social_views.py notifications_views.py` | ~490 | med |
| B5 | Recommendations & stats | `backend/userdata/recommendations.py metadata_backfill.py genre_families.py stats_views.py signals.py` | ~1,400 | low |
| B6 | Data layer | `backend/userdata/models.py backend/userdata/migrations backend/userdata/management` | ~1,340 | med |
| B7 ✅ | Config & startup | `backend/cinedb backend/start.py backend/warmup.py backend/docker-entrypoint.sh` | ~480 | **high** |
| F1 ✅ | API, auth & session | `src/api src/context` | ~1,410 | **high** |
| F2 | Hooks & utils | `src/hooks src/utils` | ~3,110 | med |
| F3 | Pages (split account vs library/browse if shallow) | `src/pages` | ~4,900 | med |
| F4 | Components (split detail/media vs rest if shallow) | `src/components` | ~4,800 | low |
| F5 | Shell & theme | `src/App.tsx src/index.tsx src/*.css src/constants src/theme src/types` | ~1,900 | low |
| I1 ✅ | Deploy & CI | `nginx.conf Dockerfile.frontend backend/Dockerfile docker-compose.yml .github/workflows scripts` | ~550 | **high** |

Line counts exclude tests (2026-10-30). Done: B1 (item 50, `fix-auth-sweep-b1`, 0.31.1), B2 (item 51, `fix-tmdb-sweep-b2`, 0.31.2), F1 (item 52, `fix-session-sweep-f1`, 0.31.3), B3 (item 53, `fix-library-sweep-b3`, 0.31.4), I1 (item 54, `fix-deploy-sweep-i1`, 0.31.5), B7 (item 55, `fix-config-sweep-b7`, 0.31.6). Next: B4. Next feature after the sweep: item 2, rating queue.

## Tier 1: quick wins

Small, self-contained, and they fit the existing patterns.

1. **Spoiler shield** (S). Blur stills and overviews for episodes past your `EpisodeProgress`, tap to reveal. *Done in 0.30.0 (`spoiler-shield`, archived 2026-10-21): hidden content is left out of the page rather than blurred.*
   - **Follow-ups (S, from the 0.30.0 review, BUG_BACKLOG item 47).** Both change the `spoiler-shield` spec, so each needs its own change:
     - Hide the score on a hidden row. A standout rating (9.9 among 8.x) can mark the big episode. Runtime and air date are weaker hints; keep them.
     - Shield specials. A post-finale special's title and overview can spoil the ending, but specials have no place in the progress order. Options: hide all specials while the shield is on, or hide those that aired after the tracked episode.
2. **Rating queue** (S). "11 watched, unrated": batch quick-rate with a 1–10 tap. Rated titles weigh more in recommendations.
3. **Hot takes and rating habits** (S). Biggest gaps between your rating and `vote_average` (stored on `WatchedEntry`): contrarian score, "guilty pleasures" (you 9, TMDB 5.2), and "you rate 1.4 above TMDB on average".
4. **On this day** (S). "One year ago today you watched Dune, rated 9." Home strip; day from `entry_day`, so zone-correct.
5. **Paste a link** (S). An IMDb / Letterboxd / JustWatch URL pasted into search resolves through TMDB `/find/{imdb_id}?external_source=imdb_id` and opens the detail page.
6. **Watchlist provenance and notes** (S). Record where an add came from (rec section, person page, search) plus an optional one-line note. Answers "why is this on my list?" two years later.
7. **"Why you'll like it" lines** (S–M). One templated sentence per recommendation card from existing cluster data ("shares director and tone with 3 titles you rated 9"). No LLM.
8. **Completion tracking** (S–M). "7 of 10 Nolan films seen" on person pages (from cached `person_credits`) and "23/33 seen" for franchises (`belongs_to_collection`, release vs chronological order).

## Tier 2: foundation and high-value features

9. **"My services" setting** (S, foundation). The streaming services you pay for, stored per account. Unlocks items 10, 11 and 12.
10. **Availability alerts and release radar** (M). One feature for "can I watch it yet?":
    - unreleased watchlist titles with countdowns;
    - "hits digital in your region on <date>" from `release_dates` type 4;
    - a watchlist title just landed on one of your services.
    
    Goes through the notifications poll and its budgets.
11. **Smart lists and "Tonight"** (M). Saved rules instead of picked items ("unwatched, < 100 min, TMDB ≥ 7.5, on my services"), stored as query JSON. "Tonight" is a preset of the same engine: minutes available + mood → 3 picks from your watchlist, with a "surprise me" random pick.
12. **Subscription rotation planner** (M). Per service: watches in the last 90 days vs watchlist titles available there → keep / pause / "binge next month, then cancel". Novel: no similar app does it.
13. **"Up Next" TV hub with binge planner** (M). In-progress shows grouped as Behind (aired episodes waiting), Caught up (next air date from `next_episode_to_air`) and Stalled (90 days without progress: "still watching?"), plus "4 seasons left = 14 h, finish on 03-11". One TMDB show detail per tracked show, so it falls under the budget and deadline rules.
14. **Imports from other services** (M). One importer family on the paced lookup and `bulk_import`:
    - Letterboxd and IMDb exports (title + year → TMDB id);
    - Netflix `ViewingActivity.csv` (title + date only; episode rows grouped into the show).
    
    Fuzzy matches get a review step before the write. Best way to bring in new users.
15. **Fix my library** (M). One page for:
    - rows without a poster (paced re-lookup through `lookupImportPosters`);
    - watches without runtime (Hours Watched undercounts);
    - zone-less old watches;
    - shows on Watched with progress mid-season.
16. **Ranked and tier lists** (M). A `position` field with drag to reorder, plus a tier-list layout (S/A/B/C/D rows) for any list.
17. **Undo instead of confirm** (S–M). "Removed from watchlist · Undo" replaces the `ConfirmIconButton` popconfirm. Rules to keep:
    - success shows only after `await`;
    - the per-item inflight slot covers the undo write.
18. **Localized TMDB data** (M). A language preference next to region: titles, overviews and posters through `language` + `include_image_language`. Proxy cache keys already include params. UI text stays English.
19. **Stats additions** (S–M):
    - a taste timeline (genre share per year as a stream chart);
    - gaps (top-rated titles in your top genres you haven't seen);
    - challenges (one per decade, 20 countries, 50 in a year).

## Tier 3: big bets

Large, or they need new infrastructure first.

20. **Diary and rewatches** (L). Split "seen" (set) from viewing events (1..n per title: time, zone, rating, company, place, mood). Unlocks "watched 4×", rating history and a personal diary calendar. Touches `WatchedContext`, imports, backups, Stats and recommendation seeding.
21. **Year in Review ("Wrapped")** (M, better after 20 and 23). A story-style sequence: longest binge, genre of the year, most-watched director, hot takes.
22. **"Faces you keep seeing"** (M–L). Recurring cast and crew across watched titles you don't follow ("14 films with Brian Cox. Follow?"). Credits come from a paced backfill under a `tmdb_budget` grant, never in the request.
23. **Image share renderer** (M, foundation). One renderer for lists, a rating with review, hot takes, tier lists and Wrapped. Check TMDB image CORS first: without it a client canvas is tainted.
24. **Per-user secret URL tokens** (M, foundation). Create, rotate, revoke, redact in the nginx `redacted` log format, own throttle scope. Unlocks 25 and 26.
25. **Subscribable calendar feed** (M, needs 24). `webcal://` feed of followed people's releases and watchlist titles, replacing the one-shot `.ics`.
26. **Plex/Jellyfin scrobble** (M, needs 24). Per-user webhook: finished playback marks the title watched (runtime, platform "Plex").
27. **Scheduler in the Docker stack** (M, foundation). Unlocks 28, guest cleanup (29) and push-style alerts.
28. **Weekly email digest** (M, needs 24 and 27). New from followed people, availability alerts, your week in watching. Opt-in with an unsubscribe token link.
29. **Guest demo mode** (M–L, needs 27, once deployed). "Try it" creates a seeded 24-hour account. Own throttle scope, a cap on live guests, no email or TMDB connect.
30. **Vibe search (LLM)** (M). "The movie where a guy grows potatoes on Mars": Claude maps the query to TMDB discover params or candidates, each verified against TMDB. Key in `.env`, own throttle scope, budget and off switch.
31. **PWA with offline library and share target** (M–L). Service worker plus a cached library. A manifest `share_target` adds links shared from other apps to the watchlist. Watch the CSP (`worker-src`), nginx cache rules and auth.

## Tier 4: nice to have

32. **Watchlist triage** (S–M). One poster at a time (keep / drop / mark seen), headed by "your watchlist = 312 h".
33. **Pairwise bracket** (M). "Which did you like more?" builds an Elo ranking and suggests rating changes where picks contradict scores.
34. **Compare view** (S–M). Two or three titles side by side: runtime, scores, your services, taste overlap.
35. **Episode ratings with a season heat grid** (M).
36. **Command palette, Ctrl+K** (M). Jump to a page or title, or run actions ("mark watched: Dune").
37. **Ambient theming** (M). Detail gradient from the poster's dominant color, within the no-color-literal and contrast-floor rules.
38. **Play** (S–M). A backdrop quiz from your own watched titles, and a six-degrees cast path (watch the TMDB budget).
39. **Ops page, owner only** (M). Proxy cache hit rate, `tmdb_budget` use, refresh backoffs, notification budget overruns. Needs a staff-only gate.

## Parked: needs an identity decision

These turn CINE DB from single-player into social, and cross the session and account isolation (`bindSessionUser`, `sessionGuard`). Decide whether the app stays single-player before any of them.

- **Shareable read-only lists** (public link with a slug token, built on 24).
- **Taste match** between two accounts.
- **Watch party** (overlap of several users' watchlists, then vote).
- **Household profiles** (several viewers per account, kid profile with a certification cap). This one is single-account, but every library table gains a profile id.

---

## Foundations

| Foundation | Unlocks |
|---|---|
| 9. "My services" setting | 10 availability alerts, 11 smart lists / Tonight, 12 subscription planner, 34 compare |
| 24. Secret URL tokens | 25 webcal feed, 26 scrobble, 28 digest unsubscribe, shareable lists |
| 27. Scheduler | 28 digest, 29 guest cleanup, push-style alerts |
| 23. Image share renderer | 21 Wrapped, 16 tier lists, 3 hot takes |
| 20. Diary | 21 Wrapped, rating history, context-aware Tonight |

## Merged during cleanup

- Spin the wheel → "surprise me" in Tonight (11).
- Tonight + smart lists → one rules engine (11).
- Watchlist streaming alerts + release radar + digital release date → availability alerts (10).
- Provenance + note to future self → 6.
- Hot takes + rating habits → 3.
- Filmography completion + franchise tracker → completion tracking (8).
- Taste timeline + gaps + challenges → Stats additions (19).
- Letterboxd/IMDb import + Netflix import → imports (14).
- Ranked lists + tier lists → 16.
- Context tags → part of the diary (20).
- Watchlist cost in time → header of watchlist triage (32).
- Share cards → image share renderer (23).
- PWA + share target → 31.
- Backdrop quiz + six degrees → play (38).
