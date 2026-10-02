from fastapi import APIRouter

router = APIRouter(prefix="/auth", tags=["Auth & RBAC (Phase 5)"])


@router.get("/me", summary="Current user profile (Phase 5 placeholder)")
async def get_current_user_stub():
    return {
        "message": "Auth will be activated in Phase 5",
        "user": {"id": "dev-user", "role": "admin", "full_name": "Developer Admin"},
    }
