## Context

`/login` renders outside the app shell: `App.tsx` mounts `Sidebar` and `BottomNav` only when authenticated, so the page owns the whole viewport. Today it is a centred antd `Card` (max 360px) with a level-3 "Sign In" title, two fields, a block primary button and two text links. The only CINE DB branding in the app is the sidebar's inline gold `Typography.Title` (letter-spacing 3, weight 700).

Constraints from the repo: Poppins is the only font (confirmed for this pilot); font sizes come from `FONT_SIZE` (12/14/16/28) or antd heading tokens; no color literals outside `constants/`, `theme/` and `utils/colors.ts`; every theme-scoped `App.css` rule needs its light/dark sibling; layout is CSS breakpoints only; JS motion checks `useReducedMotion()` and CSS motion is cut by the existing `prefers-reduced-motion` rule; secondary/tertiary text tokens already meet 4.5:1.

The direction is chosen by the `frontend-design` skill at apply time, inside the "cinematic" mood the user picked: build on the navy+gold / cream identity rather than introduce a new palette.

## Goals / Non-Goals

**Goals:**
- A sign-in screen that reads as CINE DB at a glance, in both themes.
- A visual language small enough to judge in one page and reuse on the other auth pages.
- Zero behaviour change in the form.

**Non-Goals:**
- Register, Forgot password, Reset password and the TMDB callback page (follow-up change if the pilot is accepted).
- Changing `antdTheme.ts` tokens, `FONT_SIZE` or the sidebar wordmark.
- Poster walls, backdrops or any TMDB-sourced imagery.
- A new font.

## Decisions

1. **Stage + card, not a full-bleed split layout.** A centred composition (wordmark and tagline above a card that sits on a layered background) works the same at 320px and 1920px, so it needs one breakpoint tweak at most. A desktop split (brand panel left, form right) was considered; it doubles the layout work and has to collapse on phones, which is a weak test of the direction for its cost.

2. **Depth from CSS gradients on theme-scoped classes.** The "cinema" feel (a dark auditorium with a gold spotlight; in light mode a warm paper stage) comes from radial/linear gradients on a page-level class (e.g. `.auth-stage`), written once under `body.dark-theme` and once under `body:not(.dark-theme)`. Gradient colors reuse the existing theme values; any new named color goes into `src/constants/ui.ts`, never inline. Alternative: a TMDB backdrop image. Rejected: it adds a request, a CSP `img-src` dependency (already allowed, but still a failure mode), a fallback, and makes screenshots non-deterministic.

3. **Wordmark as a small shared component.** Extract `Wordmark` (gold "CINE DB", letter-spaced, weight 700) into `src/components/` with a size prop, used by the login page. The sidebar keeps its own markup in this change, to avoid touching the 1366×768 sidebar budget; switching it over is a follow-up once the look is accepted.

4. **Type hierarchy within existing steps.** Wordmark at `FONT_SIZE.display` (28) or the heading-2 token (30) with wide letter-spacing; tagline at `FONT_SIZE.body` in `colorTextSecondary`; the card's own "Sign In" heading drops to level 4 or becomes the card's quieter label, so the wordmark leads. No new `FONT_SIZE` entry unless the skill shows the 28→16 gap can't carry it; if one is added, it is added to `typography.ts`, not inlined.

5. **Motion is optional and CSS-first.** At most a short fade/rise of the stage on mount. CSS transitions are already cut by the global reduced-motion rule; if framer-motion is used instead, it relies on the app-wide `MotionConfig reducedMotion="user"`. No looping animation.

6. **Form untouched.** Same `Form.Item` names, labels, `autoComplete`, `autoFocus`, `disabled`/`loading` and messages. Only wrapper markup, classes and the heading change, so `login-page` scenarios and existing tests hold.

7. **Verification by measurement, not by eye alone.** Add an e2e check that the wordmark and tagline are visible in both themes, and extend the theme-readability check to `/login` so its new text is measured at ≥ 4.5:1. The existing narrow-phone overflow test covers 320px. Screenshots in both themes at phone/tablet/desktop go to the user for the accept/reject call.

8. **Chosen direction (task 1.1): "the projector beam".** Subject: a personal film and TV diary; job of the page: get a returning user signed in in seconds. One memorable element only: a soft cone of light falls from above the top edge of the viewport onto the card, so the card reads as the screen the beam lands on. Everything else stays quiet.
   - Palette (all existing values): dark: ink `#0d0f1a`, screen `#1a1d2e`, marquee gold `#f5c518`, silver text `#e8e8e8`. Light: paper `#f8f3e8`, card `#fffdf8`, ink-brown `#2b2620`, and one new value, brass `#7d5f00` (5.4:1 on paper), because gold on paper measures 1.5:1 and fails as text.
   - Type: Poppins throughout. The wordmark "CINE DB" is the page's `h1`, gold (brass in light), weight 700, tracked wide (0.32em, offset with a matching negative right margin so it centres optically), with a faint gold glow in dark mode only, like a lit marquee. Tagline at body size in `colorTextSecondary`: "Track what you've watched and find what to watch next."
   - Layout: centred column (wordmark, tagline, card) on a full-bleed stage; inside the card, labels and fields stay left-aligned.
     ```
             ╲   beam   ╱
               C I N E  D B
       Track what you've watched…
            ┌──────────────┐
            │ Username     │  ← lit "screen": gold-tinted edge + glow beneath
            │ Password     │
            │ [ Sign In ]  │
            │ Forgot? Reg. │
            └──────────────┘
     ```
   - Motion: one moment. The beam fades up once on load (about 1.4 s, like a projector warming), nothing loops, nothing else animates. The global reduced-motion rule finishes it at once.
   - Review against defaults: dropped a tracked caps "WELCOME BACK" eyebrow; the card's own "Sign In" heading stays, demoted to a left-aligned `h2` at `FONT_SIZE.emphasis` so the wordmark leads (screen readers need a heading that names the page's purpose, and `auth.spec.ts` / `test_auth.py` look for it); kept gradients to the single figurative beam instead of decorative washes; the navy+gold and cream bases are the brief's existing brand, not a new default.
   - Two fixes the "before" screenshots exposed, scoped to this page for the pilot: the primary button's white text on gold (about 1.6:1) becomes dark text (`ON_GOLD_TEXT`), and the default blue links become gold (dark) / brass (light). Both are candidates to promote to theme tokens in the follow-up.
   - Colors for the stage live in `App.css`'s theme-scoped rules (each dark rule with its light sibling), so `src/constants/ui.ts` gets no new constant and the TSX stays free of color literals.

9. **One logic fix the restyle exposed.** After a failed login the page focused the password field from a `setTimeout(0)`, which could run before React re-enabled the field; a disabled input ignores `focus()`. The heavier stage paint made `auth.spec.ts`'s "keeps username filled" fail 1 in 12 (0 in 12 before). The focus now happens in an effect once `loading` is false, so the `login-page` "Wrong password" scenario no longer depends on timing.

## Outcome

Accepted by the user on 2026-10-16 after reviewing before/after screenshots in both themes (320, 375, 820, 1366 px). Follow-up change, to be proposed separately:

- Apply the stage, `Wordmark` and tagline pattern to Register, Forgot password and Reset password (and check the TMDB callback page).
- Switch the sidebar's inline "CINE DB" title to `Wordmark`, checking the 1366×768 sidebar height budget and the brass color in light mode (the sidebar's gold wordmark also measures 1.5:1 on cream today).
- Promote the two page-scoped fixes to theme tokens: dark text on the gold primary button, and gold/brass links instead of antd's default blue, in both theme configs.

## Risks / Trade-offs

- [Gradient behind the card lowers contrast for text placed on it (wordmark, tagline, links)] → measure in the readability e2e; keep body text on the card surface, only the wordmark and tagline on the stage.
- [Glassy card over a gradient renders differently in the light theme] → design both themes in the same pass; the light theme is reviewed first, since it is the one that has looked unfinished before.
- [Taste mismatch, the point of a pilot] → the change is confined to one page plus one small component and CSS, so reverting is cheap.
- [Wordmark component duplicates the sidebar markup until the follow-up] → accepted for the pilot; noted as a follow-up task.
- [Test selectors on the heading] → existing tests that look for a "Sign In" heading are checked before changing its level; the button name stays "Sign In" in any case.
