# CLAUDE.md

Guidance for Claude Code when working in this repo. See `README.md` for full feature/architecture docs — this file covers conventions not obvious from reading the code once.

## Stack
- Frontend: React 18 + TypeScript (strict) + Ant Design 5, CRA (`react-scripts`), React Router v6, Framer Motion, Recharts.
- Backend: Django 4 + DRF + PostgreSQL, JWT auth (`djangorestframework-simplejwt`).
- `npm run dev` starts all three: Express proxy (3001), React dev server (3000), Django (8000). Django runs via the Anaconda env: `G:/Anaconda/envs/django/python.exe` (see `package.json` scripts) — use that interpreter for any manual `manage.py` command, not system Python.

## Conventions to reuse, don't reinvent
- **Font size**: never hardcode `fontSize: N`. Import `FONT_SIZE` from `src/constants/typography.ts` (`caption` 12 / `body` 14 / `emphasis` 16 / `display` 28). Icon-scaling `fontSize` props (antd icons) are the one exception — those stay numeric.
- **Info tooltips**: use `<InfoTooltip title="..." />` from `src/components/InfoTooltip.tsx` (wraps antd `Tooltip` + `InfoCircleOutlined`) next to any label/stat that needs a one-line explanation. Don't hand-roll a new `Tooltip`+icon pairing.
- **Dates**: render with `formatDateDMY()` from `src/utils/formatDate.ts` — fixed `dd-mm-yyyy`, not locale-dependent `toLocaleDateString()`.
- **Fonts**: Poppins is set once via `commonTokens.fontFamily` in `src/theme/antdTheme.ts`. Never add a per-component `fontFamily` override.

## Verification
- Typecheck: `npx tsc --noEmit` (fast, always run after TSX/TS edits).
- To actually see a change: `npm run dev`, then drive it with Playwright (`playwright-core` is already a devDependency) — most pages require an authenticated user. Fastest path: register a throwaway account via `/register` (no email verification), then navigate. Movie ID `550` (Fight Club) is a reliable TMDB id for detail-page checks.
- Write any verification scripts into the project root as `verify_*.js` and delete them before finishing — don't leave scratch scripts in the tree (`.gitignore` also excludes this pattern as a backstop).

## Don't
- Don't bypass `docker-entrypoint.sh` / `backend/start.py` migration flow — `makemigrations` is intentionally not run automatically at boot; generate migrations explicitly.
- Don't add a new localStorage-backed data store — all user data (watchlist/watched/ratings/lists/etc.) lives in PostgreSQL via the Django API.
