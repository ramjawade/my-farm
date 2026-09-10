"""UUIDv7 generation.

Python 3.12 (this project's target — pyproject.toml) has no `uuid.uuid7()`;
that lands in 3.14. UUIDv7 is the server-side default id (BACKEND_PLAN.md
§6.1): it sorts roughly by creation time, which keeps primary-key inserts
index-friendly.
"""

import os
import time
import uuid


def uuid7() -> uuid.UUID:
    """Generate a UUIDv7 (RFC 9562): 48-bit ms timestamp + random tail."""
    unix_ts_ms = int(time.time() * 1000)
    rand = os.urandom(10)

    rand_a = (int.from_bytes(rand[0:2], "big") & 0x0FFF) | 0x7000
    rand_b = (int.from_bytes(rand[2:10], "big") & 0x3FFFFFFFFFFFFFFF) | 0x8000000000000000

    value = (unix_ts_ms << 80) | (rand_a << 64) | rand_b
    return uuid.UUID(int=value)
