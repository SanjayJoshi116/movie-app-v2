## 1. Code fixes the new tests need

- [x] 1.1 `BottomNav.tsx`: give the phone drawer's profile button `aria-label="Edit profile"` and the sign-out button `aria-label="Sign out"`.
- [x] 1.2 Import dialogs report a failed post-import refresh (design §6):
  - `CSVImportAllModal` inspects its `Promise.allSettled` reload results.
  - `CSVUploadModal` and `CSVListImportModal` catch their awaited reload.
  - On a rejected refresh after at least one saved entry, show "Imported, but couldn't refresh your library. Reload the page to see the new entries." The import summary is left as is.
- [x] 1.3 Add `backend/warmup.py` with `run_warmup(cmd, timeout=30) -> bool` (no Django imports), and make `start.py` step 3 call it. The skip message and behavior stay the same.

- [x] 1.4 (Found by 5.2) `AnimePage.tsx`: the TV/Movies toggle clears genres and calls `onMediaTypeChange` in its handler, so no request goes out with the previous media type's `with_genres`. CLAUDE.md's browse-filters bullet notes it.

## 2. Import dialogs (data-backup), `e2e/import.spec.ts`

- [x] 2.1 Add the helpers:
  - a ZIP builder (`jszip`, the `backup.ts` column layout)
  - stateful bulk/list mocks: one handler per pattern, branching on method, a `Set` of created keys, `{added, skipped}` responses, `paginated()` list GETs
- [x] 2.2 "One section fails": the watchlist bulk call returns `500`. The watched and list-item requests are still sent, and the result shows the watchlist as failed and real counts for the rest.
- [x] 2.3 "New list in the backup": the list is created exactly once, its items are added, and there's no error.
- [x] 2.4 "Import twice": the second import reports everything skipped and sends no second list create.
- [x] 2.5 "Re-select the same file": pick a malformed CSV, see the parse error, pick the same file again, and the error shows again. Cover the CSV dialog and the backup dialog.
- [x] 2.6 Mixed-type CSV with "Movies" selected:
  - the preview shows each row's type
  - the bulk request carries `tv` for the `tv` rows
- [x] 2.7 A failed refresh after an import shows the 1.2 notice, and the items already shown stay.

## 3. Write feedback, load states, library filters (TS e2e)

- [x] 3.1 Remove an existing rating:
  - the DELETE is sent, the dialog closes, and the title shows unrated
  - for an unrated title, the dialog has no Remove action
- [x] 3.2 "Mark as watched fails" from the Watchlist:
  - an error is shown and no "Marked as watched" success toast appears
  - the item still shows not-watched
- [x] 3.3 Episode-progress save fails on a TV detail page: an error is shown, and the stepper still shows the season and episode the user set.
- [x] 3.4 "Two lists": search "star" on list A, open list B (search empty, all items shown), return to A (search still "star").
- [x] 3.5 "Unmark the last item on the last page": Watched page 3 has one item; unmarking it shows page 2 with its items.

## 4. Auth, routing, accessibility (TS e2e)

- [x] 4.1 After a failed login, the password field is empty and focused (`toBeFocused`), and the username keeps its value.
- [x] 4.2 Signed out, open `/moviez`: the user is sent to `/login`. After signing in, the URL is `/moviez` and "Page not found" shows with a link to Movies.
- [x] 4.3 At 375px, the drawer's "Edit profile" and "Sign out" buttons are found by role and name. Each is reached with Tab and works with Enter: the profile dialog opens, and sign-out signs the user out.

## 5. Browse filters and view restore (TS e2e)

- [x] 5.1 Anime → TV → "Airing Today" with `timezoneId` and a fixed clock where the local date is ahead of UTC: `air_date.gte` and `air_date.lte` both equal the local date.
- [x] 5.2 Anime: select a genre on TV, toggle to Movies, and the next discover request has no `with_genres`. Do the same for Movies → TV.
- [x] 5.3 "Leave mid-computation": For You's mock returns `pending`. Navigate away, flip the mock to `ready`, come back, and the page polls and shows the personalized group.

## 6. Theme readability, `e2e/theme-readability.spec.ts`

- [x] 6.1 Add the contrast helper: the computed foreground color, the first opaque ancestor's background, and the WCAG ratio.
- [x] 6.2 Stats in light mode (theme forced through a JSON-encoded `cinedb_theme`):
  - stat-card labels, the "Less"/"More" legend and month labels reach ≥ 4.5:1
  - empty heatmap cells reach ≥ 1.2:1 against their background
  - a hovered chart tooltip and heatmap tooltip reach ≥ 4.5:1
- [x] 6.3 The same Stats checks in dark mode ("Dark mode unchanged", design §3).
- [x] 6.4 Light mode:
  - an idle card's watched and watchlist icons use the theme text color, not `rgb(0, 0, 0)`, at ≥ 3:1
  - an empty Search/Calendar/For You state's icon is readable and isn't the old fixed gray
  - a missing-poster placeholder has a light fill and text at ≥ 4.5:1

## 7. Backend and deployment checks

- [x] 7.1 `test_settings_fail_closed.py`: with `DEBUG` off and the built-in default `SECRET_KEY`, startup fails with `ImproperlyConfigured` naming `SECRET_KEY`.
- [x] 7.2 `test_logging.py`: with `DEBUG=True`, an unhandled exception containing the TMDB key logs a traceback with the placeholder, not the key.
- [x] 7.3 Add `test_startup_warmup.py`:
  - `run_warmup` returns `False` without raising, both for a hang past the timeout and for a non-zero exit
  - it returns `True` on success
  - the entrypoint's warm-up line is shaped `timeout 30 … || echo …` under `set -e`
  - on POSIX only, the substituted line runs under `sh -ec` and the script continues
- [x] 7.4 Add `test_compose_config.py`:
  - the `db:` block uses only `env_file: .env.db`, has only `POSTGRES_*` environment keys, and has no `.env.docker`
  - `backend/.dockerignore` excludes `.env.local`, `.env.docker.bak` and `x.env.bak`, and keeps `.env.example`
- [x] 7.5 `test_nginx_conf.py`: the HSTS `map` gives `https` → `max-age` ≥ 15552000 and `default` → empty, and the `add_header Strict-Transport-Security $hsts_header always` sits at server level.
- [x] 7.6 `.github/scripts/smoke-frontend.sh`: `/` with `X-Forwarded-Proto: https` carries `Strict-Transport-Security`, and `/` without it doesn't.
- [x] 7.7 App identity (a backend test reading `public/` or a TS test of the served page):
  - the manifest `name`/`short_name` are "CINE DB"
  - the meta description mentions movies and TV shows
  - neither `index.html` nor the manifest contains "create-react-app" or "React App"

## 8. Verify and record

- [x] 8.1 Run the checks:
  - `npm run typecheck`
  - `npm run lint`
  - `npx playwright test` (new specs pass, no retries)
  - `npm test -- --watchAll=false`
  - backend `pytest`
  - `ruff check backend/`
  - `makemigrations --check --dry-run`
- [x] 8.2 Any test that exposed a non-trivial bug gets a `fixme`/`xfail(strict=True)` and a backlog entry (design §8). List them in the backlog.
- [x] 8.3 Update `docs/BUG_BACKLOG.md`: the 21c row → 📝 now, ✅ at archive. When reporting, say that the Docker-only checks (7.3 POSIX run, 7.6) run only in CI.
