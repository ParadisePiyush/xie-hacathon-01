from typing import Any, Dict, List
from fastapi import APIRouter, Response

from app.services.analytics_service import analytics_service
from app.services.notification_service import notification_service

router = APIRouter(prefix="/analytics", tags=["Analytics & Operations Telemetry"])


@router.get("/summary", summary="Retrieve aggregated operations and SLA metrics")
async def get_summary_metrics() -> Dict[str, Any]:
    """Provides key operational KPIs: open backlog, SLA compliance, response time, and km saved."""
    return await analytics_service.get_summary_metrics()


@router.get("/heatmap", summary="Retrieve spatial heatmap clusters and intensity weights")
async def get_heatmap_points() -> List[Dict[str, Any]]:
    """Returns spatial cluster centroids and normalized intensity weights for waste density heatmap."""
    return await analytics_service.get_heatmap_points()


@router.get("/teams", summary="Retrieve team and crew productivity metrics")
async def get_team_productivity() -> List[Dict[str, Any]]:
    """Provides per-team statistics on stops collected, distance travelled, and vehicle allocation."""
    return await analytics_service.get_team_productivity()


@router.get("/notifications", summary="Retrieve recent operational notification log")
async def get_notifications(limit: int = 50) -> List[Dict[str, Any]]:
    """Inspect recent notification broadcasts (SMS/Email/Webhook simulations)."""
    return notification_service.get_recent_notifications(limit=limit)


@router.get("/export", summary="Export operations data as CSV")
async def export_operations_csv():
    """Download full snapshot of pickup requests and metrics as CSV."""
    csv_content = await analytics_service.export_csv_summary()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=waste_operations_report.csv",
        },
    )
