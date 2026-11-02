import time

import pytest
from django.core.cache import caches


def _clear():
    from userdata import social_views

    for alias in ("tmdb", "person_credits"):
        caches[alias].clear()
    # Followed-people fetches still running from a test that gave up on them:
    # waited out, so none lands in the next test's late results.
    deadline = time.monotonic() + 10
    while social_views._late_pending and time.monotonic() < deadline:
        time.sleep(0.01)
    # Followed-people credits that arrived after their test's request gave up.
    social_views._take_late_results()


@pytest.fixture(autouse=True)
def _empty_tmdb_caches():
    """Each test sees empty TMDB proxy and person-credits caches (and no late
    followed-people results), so a response cached by one test can't hide the
    mocked upstream call another asserts on."""
    _clear()
    yield
    _clear()
