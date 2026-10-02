from datetime import datetime, timezone
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["Health"])


class HealthCheckResponse(BaseModel):
    status: str
    service: str
    version: str
    timestamp: datetime
    phase: str


@router.get("/health", response_model=HealthCheckResponse)
async def health_check():
    return HealthCheckResponse(
        status="healthy",
        service="Smart Waste Collection Optimizer API",
        version="0.1.0",
        timestamp=datetime.now(timezone.utc),
        phase="Phase 1: Backend Foundation (In-Memory Repository)",
    )
