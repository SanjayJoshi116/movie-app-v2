## 1. LoginPage error handling

- [x] 1.1 In `onFinish`, trim `values.username` before calling `login()`
- [x] 1.2 Classify the caught error into three buckets: `status === 400 || status === 401` → invalid credentials, `status === 429` → rate limited, `!err.response || status >= 500` → server unreachable
- [x] 1.3 Add the new "Can't reach the server. Check your connection and try again." message for the server-unreachable bucket
- [x] 1.4 Verify the existing 400 → "Invalid username or password." mapping and 429 → "Too many login attempts..." mapping are unchanged

## 2. LoginPage field state

- [x] 2.1 Replace `form.resetFields()` in the failure path with `form.resetFields(["password"])` so the username value is preserved
- [x] 2.2 Focus the password field after a failed login (e.g. `form.getFieldInstance("password")?.focus()`)
- [x] 2.3 Add `autoFocus` to the username `Input`
- [x] 2.4 Pass `disabled={loading}` to the username and password `Input`/`Input.Password` components

## 3. Tests

- [x] 3.1 Add a case to `e2e/auth.spec.ts` that aborts/fails the `**/api/auth/login/` route (network error) and asserts the "Can't reach the server..." message appears
- [x] 3.2 Add a case (TS or manual check) asserting the username field still shows the typed value after a failed 400 login
- [x] 3.3 Run `npx tsc --noEmit`
- [x] 3.4 Re-run `e2e/auth.spec.ts` in full and confirm the pre-existing "shows error on invalid credentials" test still passes unchanged
