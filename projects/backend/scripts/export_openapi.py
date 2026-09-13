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
    OUTPUT_PATH.write_text(json.dumps(schema, indent=2, sort_keys=True) + "\n")
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
