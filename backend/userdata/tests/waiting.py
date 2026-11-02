import time


def wait_for(condition, timeout=5):
    """Poll `condition` until it's true or `timeout` seconds pass; returns
    whether it became true."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if condition():
            return True
        time.sleep(0.01)
    return False
