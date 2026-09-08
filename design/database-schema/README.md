# Database & Backend Design Canvas

Source for the **MyFarm Data Architecture** design canvas — the visual
counterpart to [`BACKEND_PLAN.md`](../../BACKEND_PLAN.md).

Published at: https://claude.ai/code/artifact/261b1e80-742d-4e4a-9bc3-90bcbe29da40

## Artboards

| File | Page | What it shows |
|---|---|---|
| `Main.dc.html` | ER Diagram | The normalised (3NF) Postgres schema — tenant root, farmer-owned tables, reference lookups, shared weather cache, and the relationships between them |
| `FieldReference.dc.html` | Field Reference | Every column with its Postgres type, nullability, and key role, plus the check-constraint value sets |
| `Architecture.dc.html` | Architecture | Angular PWA → Firebase Auth + FastAPI on Render → Neon Postgres, with the free-tier ceilings annotated |
| `AuthFlow.dc.html` | Flows | Phone OTP → ID token → `verify_id_token()` → just-in-time farmer provisioning, and where tenancy is enforced |
| `MigrationFlow.dc.html` | Flows | The one-time localStorage → Postgres migration with the UUIDv7 remap, and the ongoing outbox sync loop |

`canvas.json` holds the artboard layout and page grouping.

## Keeping it in step

These artboards and `BACKEND_PLAN.md` describe the same system. When the plan
changes, update both — the canvas is the diagram people look at first, so a
stale artboard is worse than no artboard.

The published artifact is the editable surface: open the URL above, edit
visually, and Save republishes it. Export the files back into this directory
so the repo keeps the source of truth under version control.

## History

An earlier version of this canvas described a **Firestore** schema, matching
the superseded plan in `PHASE_5_PLAN.md`. The backend is now FastAPI over
PostgreSQL; Firebase Auth is the only Firebase component retained. The single
remaining mention of Firestore, in the ER diagram's security note, is
deliberate — it explains that rules used to enforce tenant isolation at the
database and that the guarantee is now application code.
