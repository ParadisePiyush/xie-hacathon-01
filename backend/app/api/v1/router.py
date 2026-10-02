from fastapi import APIRouter

from app.api.v1.analytics import router as analytics_router
from app.api.v1.auth import router as auth_router
from app.api.v1.config import router as config_router
from app.api.v1.health import router as health_router
from app.api.v1.plans import router as plans_router
from app.api.v1.requests import router as requests_router
from app.api.v1.teams import router as teams_router

api_v1_router = APIRouter()

# Core Phase 1 Routers
api_v1_router.include_router(health_router)
api_v1_router.include_router(requests_router)
api_v1_router.include_router(config_router)

# Future Phase Routers
api_v1_router.include_router(plans_router)
api_v1_router.include_router(teams_router)
api_v1_router.include_router(auth_router)
api_v1_router.include_router(analytics_router)
