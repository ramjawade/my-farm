"""Add farmer.pin_hash for backend-issued PIN session auth.

Revision ID: 0002_farmer_pin_hash
Revises: 0001_init
Create Date: 2026-09-09 09:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002_farmer_pin_hash"
down_revision: str | None = "0001_init"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("farmer", sa.Column("pin_hash", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("farmer", "pin_hash")
