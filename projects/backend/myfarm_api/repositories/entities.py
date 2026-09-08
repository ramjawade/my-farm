"""Entity-specific repository instances.

`activity_expense` and `activity_attachment` are deliberately absent here:
per BACKEND_PLAN.md §6.1 they carry no `farmer_id` column of their own
(tenancy flows through `activity_id` -> `activity.farmer_id`), so
`TenantScopedCRUD` — which filters every query on `model.farmer_id` — does
not apply to them. Their endpoints (routers/activities.py) query them
directly, scoped by `activity_id`, after verifying the parent activity's
ownership through `activity_repo`.
"""

from myfarm_api.models import Activity, Crop, Farm, Land
from myfarm_api.repositories.crud import TenantScopedCRUD

farm_repo = TenantScopedCRUD(Farm)
land_repo = TenantScopedCRUD(Land)
crop_repo = TenantScopedCRUD(Crop)
activity_repo = TenantScopedCRUD(Activity)
