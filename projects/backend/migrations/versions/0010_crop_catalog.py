"""Crop catalog: predefined list, private custom crops.

Adds `category` and an owner (`farmer_id`) to `crop_catalog`, swaps the global
unique name for two partial unique indexes, loads the predefined crops, renames
Corn and Soybeans, and tidies names farmers typed in earlier.

Revision ID: 0010_crop_catalog
Revises: 0009_market_prices
Create Date: 2026-10-17 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0010_crop_catalog"
down_revision: str | None = "0009_market_prices"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None

# (name, category, mandi feed commodity or None). A copy of
# myfarm_api/core/crop_seed.py: migrations never import app code, and a test
# keeps the two equal.
PREDEFINED: list[tuple[str, str, str | None]] = [
    ("Wheat", "cereal", "Wheat"),
    ("Rice", "cereal", "Paddy(Common)"),
    ("Maize", "cereal", "Maize"),
    ("Jowar", "cereal", "Jowar(Sorghum)"),
    ("Bajra", "cereal", "Bajra(Pearl Millet/Cumbu)"),
    ("Tur", "pulse", "Arhar (Tur/Red Gram)(Whole)"),
    ("Gram", "pulse", "Bengal Gram(Gram)(Whole)"),
    ("Moong", "pulse", "Green Gram (Moong)(Whole)"),
    ("Urad", "pulse", "Black Gram (Urd Beans)(Whole)"),
    ("Soybean", "oilseed", "Soyabean"),
    ("Groundnut", "oilseed", "Groundnut"),
    ("Sunflower", "oilseed", "Sunflower"),
    ("Mustard", "oilseed", "Mustard"),
    ("Sesame", "oilseed", "Sesamum(Sesame,Gingelly,Til)"),
    ("Cotton", "cash", "Cotton"),
    ("Sugarcane", "cash", None),
    ("Turmeric", "cash", "Turmeric"),
    ("Onion", "vegetable", "Onion"),
    ("Tomato", "vegetable", "Tomato"),
    ("Potato", "vegetable", "Potato"),
    ("Brinjal", "vegetable", "Brinjal"),
    ("Cabbage", "vegetable", "Cabbage"),
    ("Cauliflower", "vegetable", "Cauliflower"),
    ("Okra", "vegetable", "Bhindi(Ladies Finger)"),
    ("Green chilli", "vegetable", "Green Chilli"),
    ("Garlic", "vegetable", "Garlic"),
    ("Ginger", "vegetable", "Ginger(Green)"),
    ("Capsicum", "vegetable", "Capsicum"),
    ("Grapes", "fruit", "Grapes"),
    ("Pomegranate", "fruit", "Pomegranate"),
    ("Banana", "fruit", "Banana"),
    ("Mango", "fruit", "Mango"),
    ("Orange", "fruit", "Orange"),
    ("Sweet lime", "fruit", "Mousambi(Sweet Lime)"),
    ("Papaya", "fruit", "Papaya"),
    ("Guava", "fruit", "Guava"),
    ("Watermelon", "fruit", "Water Melon"),
    ("Vegetables", "other", None),
    ("Fruits", "other", None),
]

RENAMES = {"Corn": "Maize", "Soybeans": "Soybean"}


def _repoint(bind: sa.engine.Connection, src: int, dst: int) -> None:
    """Move every reference from catalog row `src` to `dst`, then delete `src`."""
    params = {"s": src, "d": dst}
    # farm_crop is unique per (farm, crop type): drop rows that would collide first.
    bind.execute(
        sa.text(
            "DELETE FROM farm_crop fc USING farm_crop d "
            "WHERE fc.crop_catalog_id = :s AND d.crop_catalog_id = :d AND d.farm_id = fc.farm_id"
        ),
        params,
    )
    bind.execute(
        sa.text("UPDATE farm_crop SET crop_catalog_id = :d WHERE crop_catalog_id = :s"), params
    )
    bind.execute(sa.text("UPDATE crop SET crop_catalog_id = :d WHERE crop_catalog_id = :s"), params)
    bind.execute(sa.text("DELETE FROM crop_catalog WHERE id = :s"), params)


def _shared_id(bind: sa.engine.Connection, name: str, exact: bool = False) -> int | None:
    where = "name = :n" if exact else "lower(name) = lower(:n)"
    row = bind.execute(
        sa.text(f"SELECT id FROM crop_catalog WHERE farmer_id IS NULL AND {where} ORDER BY id"),
        {"n": name},
    ).first()
    return int(row[0]) if row else None


def upgrade() -> None:
    bind = op.get_bind()

    op.add_column("crop_catalog", sa.Column("category", sa.String(30), nullable=True))
    op.add_column(
        "crop_catalog",
        sa.Column("farmer_id", sa.BigInteger(), sa.ForeignKey("farmer.id"), nullable=True),
    )
    op.create_index("idx_crop_catalog_farmer_id", "crop_catalog", ["farmer_id"])

    # The global unique name goes (whatever it is called); the partial indexes replace it.
    inspector = sa.inspect(bind)
    for uc in inspector.get_unique_constraints("crop_catalog"):
        if uc["column_names"] == ["name"] and uc["name"]:
            op.drop_constraint(uc["name"], "crop_catalog", type_="unique")
    for ix in sa.inspect(bind).get_indexes("crop_catalog"):
        if ix.get("unique") and ix["column_names"] == ["name"] and ix["name"]:
            op.drop_index(ix["name"], table_name="crop_catalog")

    # 1. Corn -> Maize, Soybeans -> Soybean (merge when the new name already exists).
    for old, new in RENAMES.items():
        src = _shared_id(bind, old, exact=True)
        if src is None:
            continue
        dst = _shared_id(bind, new)
        if dst is not None and dst != src:
            _repoint(bind, src, dst)
        else:
            bind.execute(
                sa.text("UPDATE crop_catalog SET name = :n WHERE id = :i"), {"n": new, "i": src}
            )

    # 2. Merge shared names that differ only in case (keep the predefined spelling).
    predefined_names = {name for name, _, _ in PREDEFINED}
    rows = bind.execute(
        sa.text("SELECT id, name FROM crop_catalog WHERE farmer_id IS NULL ORDER BY id")
    ).all()
    groups: dict[str, list[tuple[int, str]]] = {}
    for row_id, name in rows:
        groups.setdefault(name.lower(), []).append((int(row_id), name))
    for members in groups.values():
        if len(members) < 2:
            continue
        keeper = next((m for m in members if m[1] in predefined_names), members[0])
        for member in members:
            if member[0] != keeper[0]:
                _repoint(bind, member[0], keeper[0])

    # 3. Load the predefined crops (rename a case variant to the predefined spelling).
    for name, category, commodity in PREDEFINED:
        existing = _shared_id(bind, name)
        values = {"n": name, "c": category, "p": commodity}
        if existing is None:
            bind.execute(
                sa.text(
                    "INSERT INTO crop_catalog (name, category, price_commodity) VALUES (:n, :c, :p)"
                ),
                values,
            )
        else:
            bind.execute(
                sa.text(
                    "UPDATE crop_catalog SET name = :n, category = :c, price_commodity = :p "
                    "WHERE id = :i"
                ),
                {**values, "i": existing},
            )

    # 4. Earlier typed names: one user -> theirs, nobody -> deleted, several -> shared.
    lowered = {n.lower() for n in predefined_names}
    others = bind.execute(
        sa.text("SELECT id, name FROM crop_catalog WHERE farmer_id IS NULL AND category IS NULL")
    ).all()
    for row_id, name in others:
        if name.lower() in lowered:
            continue
        owners = {
            int(r[0])
            for r in bind.execute(
                sa.text(
                    "SELECT farmer_id FROM crop WHERE crop_catalog_id = :i "
                    "UNION SELECT f.farmer_id FROM farm_crop fc JOIN farm f ON f.id = fc.farm_id "
                    "WHERE fc.crop_catalog_id = :i"
                ),
                {"i": row_id},
            ).all()
        }
        if not owners:
            bind.execute(sa.text("DELETE FROM crop_catalog WHERE id = :i"), {"i": row_id})
        elif len(owners) == 1:
            bind.execute(
                sa.text("UPDATE crop_catalog SET farmer_id = :f, category = 'other' WHERE id = :i"),
                {"f": owners.pop(), "i": row_id},
            )
        else:
            bind.execute(
                sa.text("UPDATE crop_catalog SET category = 'other' WHERE id = :i"), {"i": row_id}
            )

    op.execute(
        "CREATE UNIQUE INDEX uq_crop_catalog_shared_name ON crop_catalog (lower(name)) "
        "WHERE farmer_id IS NULL"
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_crop_catalog_farmer_name ON crop_catalog (farmer_id, lower(name)) "
        "WHERE farmer_id IS NOT NULL"
    )


def downgrade() -> None:
    # Best effort: renamed, merged and deleted rows are not brought back, and
    # restoring the global unique name fails if two farmers share a custom name.
    op.execute("DROP INDEX IF EXISTS uq_crop_catalog_farmer_name")
    op.execute("DROP INDEX IF EXISTS uq_crop_catalog_shared_name")
    op.drop_index("idx_crop_catalog_farmer_id", table_name="crop_catalog")
    op.drop_column("crop_catalog", "farmer_id")
    op.drop_column("crop_catalog", "category")
    op.create_unique_constraint("crop_catalog_name_key", "crop_catalog", ["name"])
