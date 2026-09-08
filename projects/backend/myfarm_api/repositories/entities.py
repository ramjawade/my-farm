"""Entity-specific repository instances."""

from myfarm_api.models import Activity, Crop, Farm, Land
from myfarm_api.repositories.crud import TenantScopedCRUD

farm_repo = TenantScopedCRUD(Farm)
land_repo = TenantScopedCRUD(Land)
crop_repo = TenantScopedCRUD(Crop)
activity_repo = TenantScopedCRUD(Activity)
