import math
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from pydantic import BaseModel

from app.core.exceptions import BadRequestException
from app.schemas.common import PaginatedResponse
from app.schemas.import_requests import ImportRequestsResult
from app.schemas.request import (
    PickupRequestCreate,
    PickupRequestDetailResponse,
    PickupRequestResponse,
    PickupRequestTransition,
    PickupRequestUpdate,
    PriorityBand,
    RequestStatus,
    WasteType,
)
from app.services.request_service import RequestService, get_request_service

router = APIRouter(prefix="/requests", tags=["Pickup Requests"])


class NearbyRequestItem(BaseModel):
    request: PickupRequestResponse
    distance_meters: float


@router.post(
    "",
    response_model=PickupRequestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create pickup request",
    description="Submit a new waste pickup request with coordinates, waste type, and volume.",
)
async def create_pickup_request(
    payload: PickupRequestCreate,
    service: RequestService = Depends(get_request_service),
):
    return await service.create_request(payload)


@router.get(
    "",
    response_model=PaginatedResponse[PickupRequestResponse],
    summary="List and filter pickup requests",
    description="Retrieve paginated list of pickup requests with multiple filters, search, and sorting.",
)
async def list_pickup_requests(
    status: Optional[RequestStatus] = None,
    waste_type: Optional[WasteType] = Query(None, alias="type"),
    priority_band: Optional[PriorityBand] = Query(None, alias="band"),
    zone_id: Optional[str] = None,
    reporter_id: Optional[str] = None,
    bbox: Optional[str] = Query(
        None,
        description="Bounding box filter in format 'min_lat,min_lng,max_lat,max_lng'",
    ),
    search: Optional[str] = Query(None, description="Search term matching address, description, or id"),
    sort_by: str = Query("priority_score", pattern="^(priority_score|created_at|updated_at|sla_due_at)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1, description="Page number starting at 1"),
    size: int = Query(50, ge=1, le=200, description="Items per page"),
    service: RequestService = Depends(get_request_service),
):
    bbox_tuple = None
    if bbox:
        parts = [p.strip() for p in bbox.split(",")]
        if len(parts) != 4:
            raise BadRequestException(
                message="Bounding box must be provided as 4 comma-separated values: min_lat,min_lng,max_lat,max_lng"
            )
        try:
            bbox_tuple = (float(parts[0]), float(parts[1]), float(parts[2]), float(parts[3]))
        except ValueError:
            raise BadRequestException(message="All bounding box coordinates must be valid numbers")

    skip = (page - 1) * size
    items, total = await service.list_requests(
        status=status,
        waste_type=waste_type,
        priority_band=priority_band,
        zone_id=zone_id,
        reporter_id=reporter_id,
        bbox=bbox_tuple,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        skip=skip,
        limit=size,
    )

    pages = math.ceil(total / size) if size > 0 else 0
    return PaginatedResponse[PickupRequestResponse](
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages,
    )


@router.get(
    "/nearby",
    response_model=List[NearbyRequestItem],
    summary="Find nearby requests",
    description="Spatial search returning requests located within radius_meters of lat/lng.",
)
async def get_nearby_requests(
    lat: float = Query(..., ge=-90.0, le=90.0, description="Latitude"),
    lng: float = Query(..., ge=-180.0, le=180.0, description="Longitude"),
    radius: float = Query(500.0, gt=0, le=50000, description="Search radius in meters"),
    status: Optional[List[RequestStatus]] = Query(None, description="Optional status filters"),
    service: RequestService = Depends(get_request_service),
):
    results = await service.find_nearby(
        latitude=lat,
        longitude=lng,
        radius_meters=radius,
        statuses=status,
    )
    return [NearbyRequestItem(request=r, distance_meters=d) for r, d in results]


@router.post(
    "/import",
    response_model=ImportRequestsResult,
    summary="Bulk import requests from CSV",
    description="Upload a CSV file or payload containing pickup requests (lat, lng, waste_type, volume, address, description).",
)
async def import_pickup_requests_csv(
    file: UploadFile = File(..., description="CSV file with columns: latitude,longitude,waste_type,volume,..."),
    service: RequestService = Depends(get_request_service),
):
    contents = await file.read()
    csv_text = contents.decode("utf-8-sig")
    return await service.import_from_csv(csv_text)


@router.get(
    "/{id}",
    response_model=PickupRequestDetailResponse,
    summary="Get request detail",
    description="Retrieve a single pickup request by ID including its complete lifecycle audit history.",
)
async def get_pickup_request_by_id(
    id: str,
    service: RequestService = Depends(get_request_service),
):
    return await service.get_request(id)


@router.patch(
    "/{id}",
    response_model=PickupRequestResponse,
    summary="Update request details",
    description="Update editable fields of a request (pre-dispatch).",
)
async def update_pickup_request(
    id: str,
    payload: PickupRequestUpdate,
    service: RequestService = Depends(get_request_service),
):
    return await service.update_request(id, payload)


@router.post(
    "/{id}/transition",
    response_model=PickupRequestResponse,
    summary="Transition request status",
    description="Transition request along its lifecycle state machine and append audit history.",
)
async def transition_pickup_request_status(
    id: str,
    payload: PickupRequestTransition,
    service: RequestService = Depends(get_request_service),
):
    return await service.transition_status(id, payload)


@router.delete(
    "/{id}",
    response_model=PickupRequestResponse,
    summary="Cancel pickup request",
    description="Cancel an active pickup request and record cancellation in audit history.",
)
async def cancel_pickup_request(
    id: str,
    reason: Optional[str] = Query(None, description="Reason for cancellation"),
    service: RequestService = Depends(get_request_service),
):
    return await service.cancel_request(id, reason=reason)
