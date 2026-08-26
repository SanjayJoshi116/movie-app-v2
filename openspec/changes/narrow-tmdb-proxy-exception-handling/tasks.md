## 1. Narrow exception handling

- [ ] 1.1 In `backend/userdata/tmdb_proxy_views.py`, change `except Exception:` to `except (requests.RequestException, ValueError):` in `tmdb_proxy`

## 2. Regression test

- [ ] 2.1 Create `backend/userdata/tests/test_tmdb_proxy.py` with a test that mocks `_session.get` to raise `requests.ConnectionError` and asserts the view still returns `502` with `{"error": "TMDB request failed."}`
- [ ] 2.2 Add a test that hits the proxy successfully (mock `_session.get` to return a response with a working `.json()`) to confirm the happy path is unaffected

## 3. Verification

- [ ] 3.1 Run the new tests: `G:/Anaconda/envs/django/python.exe backend/manage.py test userdata.tests.test_tmdb_proxy`
- [ ] 3.2 Run the full backend test suite to confirm no regressions: `G:/Anaconda/envs/django/python.exe backend/manage.py test`
