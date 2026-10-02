from fastapi import APIRouter

router = APIRouter(prefix="/plans", tags=["Planning & Dispatch (Phase 4)"])


@router.get("", summary="List plans (Phase 4 placeholder)")
async def list_plans():
    return {"message": "Plan optimization will be activated in Phase 4", "plans": []}
