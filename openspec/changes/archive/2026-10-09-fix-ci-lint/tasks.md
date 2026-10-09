## 1. Fix

- [x] 1.1 In `src/utils/__tests__/safeUrl.test.ts`, add `// eslint-disable-next-line no-script-url -- hostile input under test` above the `"javascript:alert(1)"` entry. Leave the test inputs and assertions unchanged, and don't touch the ESLint config.

## 2. Verify

- [x] 2.1 `npm run lint` exits 0 with no warnings.
- [x] 2.2 `npx react-scripts test --watchAll=false src/utils/__tests__/safeUrl.test.ts` passes, with the `javascript:alert(1)` case still running.
- [x] 2.3 `npm run typecheck` passes.

## 3. Bookkeeping

- [x] 3.1 Mark item 16 in `docs/BUG_BACKLOG.md` 📝 when proposed and ✅ when archived.
