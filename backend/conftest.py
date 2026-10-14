import pytest
from django.core.cache import caches


@pytest.fixture(autouse=True)
def _empty_tmdb_caches():
    """Each test sees empty TMDB proxy and person-credits caches, so a response
    cached by one test can't hide the mocked upstream call another asserts on."""
    for alias in ("tmdb", "person_credits"):
        caches[alias].clear()
    yield
    for alias in ("tmdb", "person_credits"):
        caches[alias].clear()
