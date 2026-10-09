## Why

`main` fails CI today. `npm run lint` runs with `--max-warnings=0`, and the `"javascript:alert(1)"` test input in `src/utils/__tests__/safeUrl.test.ts:10` (added in 0.20.0) trips ESLint's `no-script-url` rule. The `frontend` job stops at lint, so its Jest and build steps never run, and every later change lands without them (backlog item 16).

## What Changes

- Suppress `no-script-url` for the hostile-URL test inputs in `safeUrl.test.ts` only, with a line-scoped disable comment that says why. The test inputs and assertions stay exactly as they are.
- No ESLint config change: the rule stays on for app code, where a `javascript:` URL is a real bug.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. `ci-pipeline` "CI fails on any lint warning" already requires this; the change brings the code back into line with it. `skip_specs: true` is set.

## Impact

- `src/utils/__tests__/safeUrl.test.ts` only.
- CI `frontend` job: lint passes again, so Jest and the production build run on the next push.
- `docs/BUG_BACKLOG.md` item 16 status.
