from datetime import date, datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field

from app.schemas.request import PickupRequestResponse


class PlanStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class PlanGenerateRequest(BaseModel):
    plan_date: date = Field(default_factory=date.today, description="Date for which the route plan is computed")
    vehicle_ids: Optional[List[str]] = Field(None, description="Specific vehicle IDs to allocate (defaults to all active)")
    team_ids: Optional[List[str]] = Field(None, description="Specific team IDs to allocate")
    request_ids: Optional[List[str]] = Field(None, description="Specific requests to plan (defaults to all verified requests)")
    depot_id: Optional[str] = Field(None, description="Depot to start and end routes from (defaults to first depot)")


class RouteStopResponse(BaseModel):
    id: str
    route_id: str
    request_id: str
    sequence: int
    eta: Optional[datetime] = None
    outcome: Optional[str] = None  # collected, skipped
    outcome_reason: Optional[str] = None
    proof_photo_url: Optional[str] = None
    completed_at: Optional[datetime] = None
    request: PickupRequestResponse


class RouteResponse(BaseModel):
    id: str
    plan_id: str
    vehicle_id: str
    vehicle_plate: str
    distance_m: float
    duration_s: float
    polyline: Optional[str] = None
    stops: List[RouteStopResponse] = []


class PlanResponse(BaseModel):
    id: str
    plan_date: date
    status: str
    total_distance_m: float
    total_duration_s: float
    routes: List[RouteResponse] = []
    unserved_request_ids: List[str] = []
    created_at: datetime


class RouteStopCompleteRequest(BaseModel):
    outcome: str = Field(..., description="'collected' or 'skipped'")
    reason: Optional[str] = Field(None, max_length=500, description="Mandatory reason if stop was skipped")
    proof_photo_url: Optional[str] = Field(None, max_length=1000, description="Proof photo URL after collection")


class RouteReorderRequest(BaseModel):
    stop_ids: List[str] = Field(..., description="Ordered list of route stop IDs")
