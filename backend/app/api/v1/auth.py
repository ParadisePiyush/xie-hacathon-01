from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.api.deps import get_current_user
from app.core.rate_limiter import get_client_ip, rate_limiter
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.repositories.user_repository import user_repository
from app.schemas.user import (
    LoginRequest,
    TokenRefreshRequest,
    TokenResponse,
    UserCreate,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["Authentication & Security"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, request: Request):
    """Register a new citizen reporter or team member."""
    # Check duplicate email
    existing = await user_repository.get_by_email(payload.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An account with email '{payload.email}' already exists.",
        )

    user = await user_repository.create_user(payload)

    # Log audit
    await user_repository.log_audit(
        user_id=user.id,
        action="USER_REGISTER",
        entity="user",
        entity_id=user.id,
        payload={"email": user.email, "role": user.role},
    )

    access_token = create_access_token(
        data={"sub": user.id, "email": user.email, "role": user.role, "team_id": user.team_id}
    )
    refresh_token = create_refresh_token(data={"sub": user.id})

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=user,
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, request: Request):
    """Authenticate with email and password to receive JWT access and refresh tokens.
    
    Protected by 5 requests/minute rate limiter per client IP.
    """
    client_ip = get_client_ip(request)
    rate_limiter.check(f"login_{client_ip}", max_requests=5, window_seconds=60)

    user_match = await user_repository.get_by_email(payload.email)
    if not user_match:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    user, hashed_password = user_match
    if not verify_password(payload.password, hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This user account has been deactivated. Please contact an administrator.",
        )

    # Log audit
    await user_repository.log_audit(
        user_id=user.id,
        action="USER_LOGIN",
        entity="user",
        entity_id=user.id,
        payload={"ip": client_ip},
    )

    access_token = create_access_token(
        data={"sub": user.id, "email": user.email, "role": user.role, "team_id": user.team_id}
    )
    refresh_token = create_refresh_token(data={"sub": user.id})

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=user,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(payload: TokenRefreshRequest):
    """Exchange a valid refresh token for a newly signed access token."""
    try:
        data = decode_token(payload.refresh_token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token.",
        )

    if data.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type. Expected refresh token.",
        )

    user_id = data.get("sub")
    user = await user_repository.get_by_id(user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with refresh token no longer exists or is inactive.",
        )

    new_access_token = create_access_token(
        data={"sub": user.id, "email": user.email, "role": user.role, "team_id": user.team_id}
    )
    new_refresh_token = create_refresh_token(data={"sub": user.id})

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        user=user,
    )


@router.post("/logout")
async def logout(current_user: UserResponse = Depends(get_current_user)):
    """Log out the current user session and record audit event."""
    await user_repository.log_audit(
        user_id=current_user.id,
        action="USER_LOGOUT",
        entity="user",
        entity_id=current_user.id,
    )
    return {"message": "Successfully logged out."}


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: UserResponse = Depends(get_current_user)):
    """Retrieve profile and permissions for the currently authenticated user."""
    return current_user
