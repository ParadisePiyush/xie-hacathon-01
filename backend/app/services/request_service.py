from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple
import uuid

from app.core.exceptions import BadRequestException, NotFoundException
from app.repositories.request_repository import RequestRepository
from app.repositories.in_memory_request_repository import get_request_repository
from app.schemas.history import StatusHistoryItem
from app.schemas.request import (
    PickupRequestCreate,
    PickupRequestResponse,
    PickupRequestTransition,
    PickupRequestUpdate,
    PriorityBand,
    RequestStatus,
    WasteType,
)
from app.services.priority_service import PriorityService, priority_service
from app.services.state_machine import RequestStateMachine


class RequestService:
    """Core domain service for handling pickup requests and their lifecycle."""

    def __init__(
        self,
        repository: Optional[RequestRepository] = None,
        priority_engine: Optional[PriorityService] = None,
    ):
        self.repository = repository or get_request_repository()
        self.priority_service = priority_engine or priority_service

    async def create_request(self, payload: PickupRequestCreate) -> PickupRequestResponse:
        now = datetime.now(timezone.utc)
        req_id = str(uuid.uuid4())

        # SLA deadline calculation based on priority config
        sla_hours = self.priority_service.config.max_sla_hours
        sla_due_at = now + timedelta(hours=sla_hours)

        # Count nearby open reports to factor in repeat reports
        repeat_radius = self.priority_service.config.repeat_radius_meters
        nearby_count = await self.repository.count_nearby_open(
            latitude=payload.latitude,
            longitude=payload.longitude,
            radius_meters=repeat_radius,
        )

        score, band, _ = self.priority_service.calculate_score(
            waste_type=payload.waste_type,
            volume=payload.volume,
            created_at=now,
            sla_due_at=sla_due_at,
            nearby_count=nearby_count,
            now=now,
        )

        request_model = PickupRequestResponse(
            id=req_id,
            reporter_id=payload.reporter_id or "anonymous",
            latitude=payload.latitude,
            longitude=payload.longitude,
            address=payload.address,
            waste_type=payload.waste_type,
            volume=payload.volume,
            description=payload.description,
            photo_url=payload.photo_url,
            status=RequestStatus.SUBMITTED,
            priority_score=score,
            priority_band=band,
            zone_id=payload.zone_id,
            duplicate_of=None,
            repeat_count=nearby_count,
            sla_due_at=sla_due_at,
            created_at=now,
            updated_at=now,
            history=[],
        )

        # Persist request
        created = await self.repository.create(request_model)

        # Record initial status transition in audit history
        history_item = StatusHistoryItem(
            id=str(uuid.uuid4()),
            request_id=req_id,
            from_status=None,
            to_status=RequestStatus.SUBMITTED.value,
            actor_id=payload.reporter_id or "citizen",
            note="Request submitted via portal",
            created_at=now,
        )
        await self.repository.add_history(history_item)

        # Return with history populated
        return await self.repository.get_by_id(req_id)  # type: ignore

    async def get_request(self, request_id: str) -> PickupRequestResponse:
        req = await self.repository.get_by_id(request_id)
        if not req:
            raise NotFoundException(
                message=f"Pickup request '{request_id}' not found",
                details={"request_id": request_id},
            )
        return req

    async def list_requests(
        self,
        status: Optional[RequestStatus] = None,
        waste_type: Optional[WasteType] = None,
        priority_band: Optional[PriorityBand] = None,
        zone_id: Optional[str] = None,
        reporter_id: Optional[str] = None,
        bbox: Optional[Tuple[float, float, float, float]] = None,
        search: Optional[str] = None,
        sort_by: str = "priority_score",
        sort_order: str = "desc",
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[PickupRequestResponse], int]:
        return await self.repository.list_requests(
            status=status,
            waste_type=waste_type,
            priority_band=priority_band,
            zone_id=zone_id,
            reporter_id=reporter_id,
            bbox=bbox,
            search=search,
            sort_by=sort_by,
            sort_order=sort_order,
            skip=skip,
            limit=limit,
        )

    async def update_request(
        self,
        request_id: str,
        payload: PickupRequestUpdate,
    ) -> PickupRequestResponse:
        existing = await self.get_request(request_id)

        # Pre-verify or pre-dispatch editable rule
        non_editable = {
            RequestStatus.PLANNED,
            RequestStatus.IN_PROGRESS,
            RequestStatus.COLLECTED,
            RequestStatus.CANCELLED,
            RequestStatus.REJECTED,
        }
        if existing.status in non_editable:
            raise BadRequestException(
                message=f"Cannot modify request fields while in status '{existing.status.value}'",
                details={"current_status": existing.status.value},
            )

        update_data = payload.model_dump(exclude_unset=True)
        if not update_data:
            return existing

        now = datetime.now(timezone.utc)
        update_data["updated_at"] = now

        # If location, waste_type, or volume changed, recompute priority
        effective_waste_type = payload.waste_type or existing.waste_type
        effective_volume = payload.volume or existing.volume
        effective_lat = payload.latitude if payload.latitude is not None else existing.latitude
        effective_lng = payload.longitude if payload.longitude is not None else existing.longitude

        repeat_radius = self.priority_service.config.repeat_radius_meters
        nearby_count = await self.repository.count_nearby_open(
            latitude=effective_lat,
            longitude=effective_lng,
            radius_meters=repeat_radius,
            exclude_id=existing.id,
        )

        new_score, new_band, _ = self.priority_service.calculate_score(
            waste_type=effective_waste_type,
            volume=effective_volume,
            created_at=existing.created_at,
            sla_due_at=existing.sla_due_at,
            nearby_count=nearby_count,
            now=now,
        )

        update_data["priority_score"] = new_score
        update_data["priority_band"] = new_band
        update_data["repeat_count"] = nearby_count

        updated = await self.repository.update(request_id, update_data)
        if not updated:
            raise NotFoundException(message=f"Pickup request '{request_id}' not found")
        return updated

    async def transition_status(
        self,
        request_id: str,
        payload: PickupRequestTransition,
    ) -> PickupRequestResponse:
        existing = await self.get_request(request_id)

        # Validate transition using State Machine
        RequestStateMachine.validate_transition(
            from_status=existing.status,
            to_status=payload.to_status,
            reason=payload.reason or payload.note,
        )

        now = datetime.now(timezone.utc)
        update_payload = {
            "status": payload.to_status,
            "updated_at": now,
        }

        # If moving to in_progress or collected, photo or completion fields can be stored
        if payload.proof_photo_url:
            update_payload["photo_url"] = payload.proof_photo_url

        updated = await self.repository.update(request_id, update_payload)
        if not updated:
            raise NotFoundException(message=f"Pickup request '{request_id}' not found")

        # Record audit history
        history_item = StatusHistoryItem(
            id=str(uuid.uuid4()),
            request_id=request_id,
            from_status=existing.status.value,
            to_status=payload.to_status.value,
            actor_id=payload.actor_id or "dispatcher",
            note=payload.note or payload.reason,
            created_at=now,
        )
        await self.repository.add_history(history_item)

        return await self.get_request(request_id)

    async def cancel_request(
        self,
        request_id: str,
        reason: Optional[str] = None,
        actor_id: Optional[str] = "reporter",
    ) -> PickupRequestResponse:
        transition_payload = PickupRequestTransition(
            to_status=RequestStatus.CANCELLED,
            note=reason or "Cancelled by user/dispatcher",
            reason=reason or "User cancellation",
            actor_id=actor_id,
        )
        return await self.transition_status(request_id, transition_payload)

    async def find_nearby(
        self,
        latitude: float,
        longitude: float,
        radius_meters: float = 500.0,
        statuses: Optional[List[RequestStatus]] = None,
    ) -> List[Tuple[PickupRequestResponse, float]]:
        return await self.repository.find_nearby(
            latitude=latitude,
            longitude=longitude,
            radius_meters=radius_meters,
            statuses=statuses,
        )


request_service = RequestService()


def get_request_service() -> RequestService:
    return request_service
