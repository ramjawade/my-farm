"""Per-phone throttle for PIN login attempts (#308).

A 4-digit PIN has 10,000 values, so unthrottled `/auth/session` can be
brute-forced in minutes. After `login_max_failures` wrong PINs a phone is
locked for `login_lockout_seconds`; a correct PIN clears the counter.

State is per process and in memory. That is deliberate for the single-instance
deployment; a multi-instance deployment needs a shared store instead.
"""

import time
from dataclasses import dataclass

from myfarm_api.core.config import get_settings


@dataclass
class _Attempts:
    failures: int = 0
    locked_until: float = 0.0


_attempts: dict[str, _Attempts] = {}


def reset() -> None:
    """Forget every counter (tests, or an operator clearing a lockout)."""
    _attempts.clear()


def retry_after(phone: str) -> int:
    """Seconds until `phone` may try again; 0 when it is not locked."""
    entry = _attempts.get(phone)
    if entry is None:
        return 0
    remaining = entry.locked_until - time.monotonic()
    if remaining > 0:
        return int(remaining) + 1
    if entry.locked_until:  # lockout served: start a fresh window
        del _attempts[phone]
    return 0


def record_failure(phone: str) -> None:
    settings = get_settings()
    entry = _attempts.setdefault(phone, _Attempts())
    entry.failures += 1
    if entry.failures >= settings.login_max_failures:
        entry.locked_until = time.monotonic() + settings.login_lockout_seconds


def record_success(phone: str) -> None:
    _attempts.pop(phone, None)
