from fastapi import APIRouter

from app.api.v1.analytics import router as analytics_router
from app.api.v1.auth import router as auth_router
from app.api.v1.config import router as config_router
from app.api.v1.depots import router as depots_router
from app.api.v1.health import router as health_router
from app.api.v1.plans import router as plans_router
from app.api.v1.requests import router as requests_router
from app.api.v1.teams import router as teams_router
from app.api.v1.vehicles import router as vehicles_router
from app.api.v1.zones import router as zones_router

api_v1_router = APIRouter()

# Health & Core Configuration
api_v1_router.include_router(health_router)
api_v1_router.include_router(config_router)

# Requests & Lifecycle
api_v1_router.include_router(requests_router)

# Phase 2 Resources & Spatial
api_v1_router.include_router(depots_router)
api_v1_router.include_router(zones_router)
api_v1_router.include_router(teams_router)
api_v1_router.include_router(vehicles_router)

# Future Phase Routers
api_v1_router.include_router(plans_router)
api_v1_router.include_router(auth_router)
api_v1_router.include_router(analytics_router)
