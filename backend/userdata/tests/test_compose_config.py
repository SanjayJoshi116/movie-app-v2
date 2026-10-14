"""container-deployment static checks on docker-compose.yml, the Dockerfiles and
backend/.dockerignore.

Docker isn't on the dev machine; CI's docker job builds the real stack. The
compose file is read as text (no YAML parser in the backend deps), scoped to
the `db:` service block, the same way test_nginx_conf reads nginx.conf.
"""
import re
from fnmatch import fnmatch
from pathlib import Path

from django.test import SimpleTestCase

REPO = Path(__file__).resolve().parents[3]


def _service_block(compose, name):
    """The lines of one top-level service, up to the next two-space-indented key."""
    m = re.search(rf"^  {name}:\n((?:(?:    .*)?\n)*)", compose, re.M)
    assert m, f"service {name} not found"
    return m.group(1)


def _strip_comments(text):
    return "\n".join(line.split("#", 1)[0].rstrip() for line in text.splitlines()) + "\n"


class DatabaseServiceSecretsTests(SimpleTestCase):
    def setUp(self):
        compose = _strip_comments((REPO / "docker-compose.yml").read_text(encoding="utf-8"))
        self.db = _service_block(compose, "db")

    def test_reads_only_its_own_env_file(self):
        self.assertEqual(re.findall(r"\.env[\w.]*", self.db), [".env.db"])
        self.assertRegex(self.db, r"(?m)^    env_file: \.env\.db$")

    def test_environment_names_only_postgres_settings(self):
        env = re.search(r"^    environment:\n((?:      .*\n)+)", self.db, re.M)
        self.assertIsNotNone(env)
        keys = re.findall(r"^      (\w+):", env.group(1), re.M)
        self.assertTrue(keys)
        for key in keys:
            with self.subTest(key=key):
                self.assertTrue(key.startswith("POSTGRES_"), key)


class BackendDockerignoreTests(SimpleTestCase):
    """fnmatch approximates Docker's matcher; the names here avoid its edge cases."""

    def setUp(self):
        lines = (REPO / "backend" / ".dockerignore").read_text(encoding="utf-8").splitlines()
        self.rules = [line.strip() for line in lines if line.strip() and not line.startswith("#")]

    def _excluded(self, name):
        excluded = False
        for rule in self.rules:  # last match wins, `!` re-includes
            negate = rule.startswith("!")
            if fnmatch(name, rule.lstrip("!")):
                excluded = not negate
        return excluded

    def test_stray_env_copies_are_excluded(self):
        for name in (".env", ".env.local", ".env.docker", ".env.docker.bak", "x.env.bak"):
            with self.subTest(name=name):
                self.assertTrue(self._excluded(name))

    def test_committed_examples_are_kept(self):
        for name in (".env.example", ".env.db.example"):
            with self.subTest(name=name):
                self.assertFalse(self._excluded(name))


    def test_tests_and_dev_files_are_excluded(self):
        for name in ("userdata/tests/", "conftest.py", "pytest.ini", "pytest_dev_env.py",
                     "requirements-test.txt", "start.py"):
            with self.subTest(name=name):
                self.assertTrue(self._excluded(name))

    def test_runtime_files_are_kept(self):
        for name in ("manage.py", "docker-entrypoint.sh", "requirements.txt", "constraints.txt"):
            with self.subTest(name=name):
                self.assertFalse(self._excluded(name))


class PinnedBaseImageTests(SimpleTestCase):
    """Every base image is named by exact version and digest."""

    def test_every_from_and_image_has_a_digest(self):
        refs = []
        for path in ("Dockerfile.frontend", "backend/Dockerfile"):
            refs += re.findall(r"^FROM\s+(\S+)", (REPO / path).read_text(encoding="utf-8"), re.M)
        refs += re.findall(r"^\s+image:\s+(\S+)", (REPO / "docker-compose.yml").read_text(encoding="utf-8"), re.M)
        self.assertGreaterEqual(len(refs), 5)
        for ref in refs:
            with self.subTest(image=ref):
                self.assertRegex(ref, r"^[\w./-]+:\d[\w.-]*@sha256:[0-9a-f]{64}$")
