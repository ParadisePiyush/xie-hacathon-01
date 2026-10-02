from fastapi import APIRouter

router = APIRouter(prefix="/analytics", tags=["Analytics & Heatmaps (Phase 6)"])


@router.get("/summary", summary="Summary metrics (Phase 6 placeholder)")
async def get_analytics_summary_stub():
    return {
        "message": "Analytics dashboard will be activated in Phase 6",
        "metrics": {"total_requests": 0, "sla_compliance_pct": 100.0},
    }
