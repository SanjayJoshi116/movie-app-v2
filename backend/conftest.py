import pytest
from django.core.cache import caches


@pytest.fixture(autouse=True)
def _empty_tmdb_proxy_cache():
    """Each test sees an empty TMDB proxy cache, so a response cached by one
    test can't hide the mocked upstream call another test asserts on."""
    caches["tmdb"].clear()
    yield
    caches["tmdb"].clear()
