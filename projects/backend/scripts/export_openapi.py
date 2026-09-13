"""Export the live FastAPI OpenAPI schema to a committed JSON file.

Run from `projects/backend/`:

    python scripts/export_openapi.py

The frontend's `npm run generate:contracts` reads this file to regenerate
`projects/home/src/app/core/api/contracts/*.contract.ts` — see issue #196.
CI re-runs this script and diffs the result against the committed copy, so
a Pydantic schema change that isn't reflected here fails the build instead
of silently drifting from what the frontend expects.
"""

import json
from pathlib import Path

from myfarm_api.main import app

OUTPUT_PATH = Path(__file__).resolve().parent.parent / "openapi.json"


def main() -> None:
    schema = app.openapi()
    # ensure_ascii=False: keep literal UTF-8 (the docstrings use real em
    # dashes/arrows) instead of \uXXXX escapes, so the diff this produces
    # against the committed file is a real content change, not an encoding
    # artifact.
    OUTPUT_PATH.write_text(
        json.dumps(schema, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
