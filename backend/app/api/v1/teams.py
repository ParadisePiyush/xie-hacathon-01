from fastapi import APIRouter

router = APIRouter(prefix="/teams", tags=["Teams & Vehicles (Phase 2+)"])


@router.get("", summary="List teams (Phase 2+ placeholder)")
async def list_teams():
    return {"message": "Teams management will be activated in Phase 2+", "teams": []}
