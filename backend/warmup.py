"""Best-effort startup warm-up, kept importable (no Django) so it can be tested.

start.py runs its steps at module level, so the bounded warm-up lives here.
docker-entrypoint.sh does the same with `timeout 30 ... || echo ...`.
"""
import subprocess


def run_warmup(cmd, timeout=30):
    """Run `cmd`, never longer than `timeout` seconds. True only on a clean exit.

    A hang or a non-zero exit is skipped, never raised: a slow or failing TMDB
    during the cache warm-up must not keep the server from starting.
    """
    try:
        result = subprocess.run(cmd, check=False, timeout=timeout)
    except subprocess.TimeoutExpired:
        print(f"[cinedb] compute_recommendations timed out after {timeout}s, skipping (best-effort)")
        return False
    if result.returncode != 0:
        print(f"[cinedb] compute_recommendations exited with {result.returncode}, skipping (best-effort)")
        return False
    return True
