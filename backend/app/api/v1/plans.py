from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status

from app.schemas.plan import (
    PlanGenerateRequest,
    PlanResponse,
    RouteResponse,
    RouteStopCompleteRequest,
    RouteStopResponse,
)
from app.services.planning_service import PlanningService, get_planning_service

router = APIRouter(tags=["Planning & Dispatch"])


@router.post(
    "/plans/generate",
    response_model=PlanResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate optimized pickup plan",
    description="Solves Capacitated VRP with OR-Tools, prioritizing critical stops and generating ordered routes per vehicle.",
)
async def generate_plan(
    payload: PlanGenerateRequest,
    service: PlanningService = Depends(get_planning_service),
):
    return await service.generate_plan(payload)


@router.get(
    "/plans",
    response_model=List[PlanResponse],
    summary="List generated plans",
)
async def list_plans(
    service: PlanningService = Depends(get_planning_service),
):
    return await service.list_plans()


@router.get(
    "/plans/{id}",
    response_model=PlanResponse,
    summary="Get plan detail",
)
async def get_plan(
    id: str,
    service: PlanningService = Depends(get_planning_service),
):
    return await service.get_plan(id)


@router.post(
    "/plans/{id}/publish",
    response_model=PlanResponse,
    summary="Publish plan",
    description="Makes the plan active and visible to assigned collectors.",
)
async def publish_plan(
    id: str,
    service: PlanningService = Depends(get_planning_service),
):
    return await service.publish_plan(id)


@router.post(
    "/plans/{id}/reoptimize",
    response_model=PlanResponse,
    summary="Re-optimize plan",
    description="Re-runs VRP solver with updated priorities or remaining open stops.",
)
async def reoptimize_plan(
    id: str,
    service: PlanningService = Depends(get_planning_service),
):
    plan = await service.get_plan(id)
    # Re-run plan generation for the same date
    return await service.generate_plan(
        PlanGenerateRequest(
            plan_date=plan.plan_date,
            vehicle_ids=[r.vehicle_id for r in plan.routes],
        )
    )


@router.get(
    "/routes/mine",
    response_model=RouteResponse,
    summary="Collector's assigned route",
    description="Fetches current active ordered route for collector's vehicle.",
)
async def get_my_route(
    vehicle_id: Optional[str] = Query(None, description="Vehicle ID (optional, defaults to active vehicle)"),
    service: PlanningService = Depends(get_planning_service),
):
    return await service.get_my_route(vehicle_id)


@router.post(
    "/route-stops/{id}/complete",
    response_model=RouteStopResponse,
    summary="Complete or skip route stop",
    description="Records stop outcome ('collected' with proof photo, or 'skipped' with reason) and cascades to request status.",
)
async def complete_route_stop(
    id: str,
    payload: RouteStopCompleteRequest,
    service: PlanningService = Depends(get_planning_service),
):
    return await service.complete_route_stop(id, payload)
