## Context

See proposal.md for the list. Three facts shape the color part:
- Components read the theme name from `useUIContext().theme` and the antd tokens from `theme.useToken()`.
- `antdTheme.ts` sets `colorText` per theme (`#e8e8e8` dark, `#2b2620` light) and `colorPrimary` to gold.
- `colorTextTertiary`, `colorFillTertiary` and their siblings aren't overridden. antd derives them from each theme's algorithm, and `StatsPage`/`ProfileModal` already rely on them.

## Goals / Non-Goals

**Goals:**
- One definition of "idle action icon color", so the 11 copies can't drift apart again.
- Every color that has to read on the page background comes from the theme.

**Non-Goals:**
- Changing the active colors (watched green, gold) or the Stats chart palette and heat scale.
- Adding new tokens to `antdTheme.ts`. The existing derived tokens are enough here.
- Restyling anything beyond these color and size swaps.

## Decisions

**1. A `useActionIconColor()` hook instead of a constant or a pure helper.**
- It returns `theme === "dark" ? RATING_GOLD : token.colorText`, reading both sources itself. Lives in `src/hooks/useActionIconColor.ts`.
- Call sites become `active ? WATCHED_GREEN : idle`.
- Alternatives considered:
  - A constant can't follow the theme.
  - A pure `iconColor(theme, token)` helper would make every caller fetch the token too.
  - antd's `colorPrimary` can't be the idle color either, because it is gold in both themes and light mode needs dark icons.

**2. The watchlist-active blue becomes `IN_WATCHLIST_BLUE` in `constants/ui.ts`.**
- It's a state color with the same role in both themes, like `WATCHED_GREEN`.
- Rejected: using a token. antd's `colorPrimary` here is gold, which would make an added title look the same as an idle one in dark mode.

**3. Muted colors map to existing tokens.**
- Empty-state icons → `colorTextTertiary`. The plan was `colorTextQuaternary`, but the live check measured it at 1.82:1 on the light background, fainter than the old `#aaa` (about 2.1:1) and under the 3:1 guideline for meaningful graphics. `colorTextTertiary` measured 3.3:1 in light and 4.52:1 in dark, the same as the Empty description text.
- Watchlist's review caption → `colorTextTertiary`.
- Genre chip border → `colorBorder`.
- `PosterPlaceholder` → `colorFillSecondary` background and `colorTextTertiary` text. It reads the token itself, since it is used everywhere.
- In dark mode the placeholder moves from `#1a1a2e` to the dark fill token. That shift is accepted, and the live check covers it.

**4. Fixed-fill text gets named constants.**
- `ON_GOLD_TEXT = "#000"` for the bottom-nav count badge and Stats' FILM/TV badge. The FILM/TV badge is gold or blue, and black reads on both.
- `AVATAR_INITIALS_TEXT = "#fff"` for the initials on `avatarColor()` backgrounds.
- They stay fixed because the fill under them doesn't change with the theme.

**5. Avatar initials use `FONT_SIZE.caption` (12).**
- The 22 px phone avatar fits two 12 px letters.
- Alternative considered: a new 10 px tier in `FONT_SIZE`. Rejected, because the scale's smallest step is 12 on purpose.

**6. The proxy spec is relaxed rather than the code changed.**
- `request.GET.lists()` groups values by name, and the cache key is built from the same list. Forwarding the raw query string would split identical requests across cache keys for no gain at TMDB.
- The new wording keeps the part that matters: every value is forwarded, and repeated values stay in order.

**7. `start.py` uses the same password fallback as `settings.py`.**
- It becomes `DB_PASSWORD` or else `POSTGRES_PASSWORD`, so a developer with only the Docker-style variable set gets the same database password at both the create-database step and Django's connection.

## Risks / Trade-offs

- **[Risk] Light-mode idle icons change from `#000000` to `#2b2620`.** → That's the theme's own text color, still dark on cream. The live check screenshots it.
- **[Resolved] `colorTextQuaternary` was too faint for empty-state icons in light mode (1.82:1).** The live check caught it, and they use `colorTextTertiary` instead.
- **[Risk] Docs edits can drift again.** → Each edit states what the code does now, with file references, rather than a summary.
