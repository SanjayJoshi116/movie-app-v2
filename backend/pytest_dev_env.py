"""Loaded via `-p pytest_dev_env` (pytest.ini) so it runs before pytest-django
imports settings — a root conftest.py is too late for that.

settings.py defaults DEBUG off and then refuses an empty ALLOWED_HOSTS. The
suite runs like local dev (CI also sets DEBUG=True explicitly), so default it
here instead of making every developer add DEBUG to their untracked .env.
"""
import os

os.environ.setdefault("DEBUG", "True")
