from fastapi import APIRouter, Depends
from app.schemas.config import PriorityConfig, PriorityConfigUpdate
from app.services.priority_service import PriorityService, priority_service

router = APIRouter(prefix="/config", tags=["Configuration"])


def get_priority_engine() -> PriorityService:
    return priority_service


@router.get("/priority", response_model=PriorityConfig)
async def get_priority_config(
    engine: PriorityService = Depends(get_priority_engine),
):
    """Retrieve current priority scoring configuration, factor weights, and bands."""
    return engine.config


@router.put("/priority", response_model=PriorityConfig)
async def update_priority_config(
    payload: PriorityConfigUpdate,
    engine: PriorityService = Depends(get_priority_engine),
):
    """Update priority scoring weights and parameters (Admin)."""
    current_config = engine.config
    updated_config = PriorityConfig(
        weights=payload.weights,
        max_sla_hours=payload.max_sla_hours,
        repeat_radius_meters=payload.repeat_radius_meters,
        repeat_saturation_count=payload.repeat_saturation_count,
        hazard_scores=current_config.hazard_scores,
        volume_scores=current_config.volume_scores,
    )
    engine.update_config(updated_config)
    return updated_config
