from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import require_roles
from app.repositories.user_repository import user_repository
from app.schemas.user import AuditLogResponse, UserCreate, UserResponse, UserUpdate

router = APIRouter(tags=["User Management & Audit (Admin)"])


@router.get("/users", response_model=List[UserResponse])
async def list_users(
    role: Optional[str] = Query(None, description="Filter by user role"),
    team_id: Optional[str] = Query(None, description="Filter by assigned team ID"),
    current_user: UserResponse = Depends(require_roles("admin")),
):
    """List all registered users (Admin only)."""
    return await user_repository.list_users(role=role, team_id=team_id)


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user_by_admin(
    payload: UserCreate,
    current_user: UserResponse = Depends(require_roles("admin")),
):
    """Create a new user with specific role and team assignment (Admin only)."""
    existing = await user_repository.get_by_email(payload.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An account with email '{payload.email}' already exists.",
        )

    user = await user_repository.create_user(payload)

    await user_repository.log_audit(
        user_id=current_user.id,
        action="USER_CREATED_BY_ADMIN",
        entity="user",
        entity_id=user.id,
        payload={"email": user.email, "role": user.role, "team_id": user.team_id},
    )

    return user


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user_by_id(
    user_id: str,
    current_user: UserResponse = Depends(require_roles("admin")),
):
    """Retrieve details for a specific user (Admin only)."""
    user = await user_repository.get_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{user_id}' not found.",
        )
    return user


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user_by_admin(
    user_id: str,
    payload: UserUpdate,
    current_user: UserResponse = Depends(require_roles("admin")),
):
    """Update role, team assignment, or active status for a user (Admin only)."""
    user = await user_repository.update_user(user_id, payload)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{user_id}' not found.",
        )

    await user_repository.log_audit(
        user_id=current_user.id,
        action="USER_UPDATED_BY_ADMIN",
        entity="user",
        entity_id=user_id,
        payload=payload.model_dump(exclude_unset=True, exclude={"password"}),
    )

    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_user_by_admin(
    user_id: str,
    current_user: UserResponse = Depends(require_roles("admin")),
):
    """Deactivate a user account (Admin only)."""
    success = await user_repository.delete_user(user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{user_id}' not found.",
        )

    await user_repository.log_audit(
        user_id=current_user.id,
        action="USER_DEACTIVATED",
        entity="user",
        entity_id=user_id,
    )
    return None


@router.get("/audit-logs", response_model=List[AuditLogResponse])
async def list_audit_logs(
    limit: int = Query(100, ge=1, le=500),
    current_user: UserResponse = Depends(require_roles("admin")),
):
    """Inspect immutable security and operations audit trail (Admin only)."""
    return await user_repository.list_audit_logs(limit=limit)
