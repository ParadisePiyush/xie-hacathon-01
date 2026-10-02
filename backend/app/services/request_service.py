import csv
from datetime import datetime, timedelta, timezone
import io
from typing import List, Optional, Tuple
import uuid

from app.core.exceptions import BadRequestException, NotFoundException
from app.repositories.in_memory_request_repository import get_request_repository
from app.repositories.request_repository import RequestRepository
from app.repositories.resource_repository import get_resource_repository
from app.schemas.history import StatusHistoryItem
from app.schemas.import_requests import ImportRequestsResult, ImportRowError
from app.schemas.request import (
    PickupRequestCreate,
    PickupRequestResponse,
    PickupRequestTransition,
    PickupRequestUpdate,
    PriorityBand,
    RequestStatus,
    Volume,
    WasteType,
)
from app.services.priority_service import PriorityService, priority_service
from app.services.spatial_service import spatial_service
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
        self.resource_repo = get_resource_repository()

    async def create_request(self, payload: PickupRequestCreate) -> PickupRequestResponse:
        now = datetime.now(timezone.utc)
        req_id = str(uuid.uuid4())

        # SLA deadline calculation based on priority config
        sla_hours = self.priority_service.config.max_sla_hours
        sla_due_at = now + timedelta(hours=sla_hours)

        # 1. Point-in-Polygon Zone Assignment (if zone_id not manually supplied)
        effective_zone_id = payload.zone_id
        if not effective_zone_id:
            zones = await self.resource_repo.list_zones()
            effective_zone_id = spatial_service.assign_zone_for_point(
                latitude=payload.latitude,
                longitude=payload.longitude,
                zones=zones,
            )

        # 2. Duplicate Detection (Phase 2):
        # Query open requests of identical waste type within 50 m and 24 h
        repeat_radius = self.priority_service.config.repeat_radius_meters
        duplicate_candidate = await self.repository.find_duplicate_candidate(
            latitude=payload.latitude,
            longitude=payload.longitude,
            waste_type=payload.waste_type,
            radius_meters=repeat_radius,
            max_age_hours=24.0,
        )

        parent_duplicate_id = None
        if duplicate_candidate:
            parent_duplicate_id = duplicate_candidate.id

        # Count nearby open reports to factor into priority repeat factor
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
            zone_id=effective_zone_id,
            duplicate_of=parent_duplicate_id,
            repeat_count=nearby_count,
            sla_due_at=sla_due_at,
            created_at=now,
            updated_at=now,
            history=[],
        )

        # Persist request
        await self.repository.create(request_model)

        # Record initial status transition in audit history
        submit_note = "Request submitted via portal"
        if parent_duplicate_id:
            submit_note += f" (linked as duplicate of {parent_duplicate_id})"

        history_item = StatusHistoryItem(
            id=str(uuid.uuid4()),
            request_id=req_id,
            from_status=None,
            to_status=RequestStatus.SUBMITTED.value,
            actor_id=payload.reporter_id or "citizen",
            note=submit_note,
            created_at=now,
        )
        await self.repository.add_history(history_item)

        # If duplicate parent exists, increment its repeat count and update its priority score
        if duplicate_candidate:
            new_parent_repeat = duplicate_candidate.repeat_count + 1
            parent_score, parent_band, _ = self.priority_service.calculate_score(
                waste_type=duplicate_candidate.waste_type,
                volume=duplicate_candidate.volume,
                created_at=duplicate_candidate.created_at,
                sla_due_at=duplicate_candidate.sla_due_at,
                nearby_count=new_parent_repeat,
                now=now,
            )
            await self.repository.update(
                duplicate_candidate.id,
                {
                    "repeat_count": new_parent_repeat,
                    "priority_score": parent_score,
                    "priority_band": parent_band,
                    "updated_at": now,
                },
            )
            await self.repository.add_history(
                StatusHistoryItem(
                    id=str(uuid.uuid4()),
                    request_id=duplicate_candidate.id,
                    from_status=duplicate_candidate.status.value,
                    to_status=duplicate_candidate.status.value,
                    actor_id="system",
                    note=f"Repeat report merged ({req_id}). Priority recalculated to {parent_score} ({parent_band.value}).",
                    created_at=now,
                )
            )

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

        effective_waste_type = payload.waste_type or existing.waste_type
        effective_volume = payload.volume or existing.volume
        effective_lat = payload.latitude if payload.latitude is not None else existing.latitude
        effective_lng = payload.longitude if payload.longitude is not None else existing.longitude

        # Check point in polygon if location changed and zone_id not explicitly given
        if (payload.latitude is not None or payload.longitude is not None) and "zone_id" not in update_data:
            zones = await self.resource_repo.list_zones()
            matched_zone = spatial_service.assign_zone_for_point(effective_lat, effective_lng, zones)
            if matched_zone:
                update_data["zone_id"] = matched_zone

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

        if payload.proof_photo_url:
            update_payload["photo_url"] = payload.proof_photo_url

        updated = await self.repository.update(request_id, update_payload)
        if not updated:
            raise NotFoundException(message=f"Pickup request '{request_id}' not found")

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

    async def import_from_csv(self, csv_text: str) -> ImportRequestsResult:
        """Parses CSV text and bulk-creates pickup requests with validation."""
        reader = csv.DictReader(io.StringIO(csv_text))
        errors: List[ImportRowError] = []
        sample_imported: List[PickupRequestResponse] = []
        imported_count = 0
        total_rows = 0

        for row_idx, row in enumerate(reader, start=2):  # 1-indexed, header is row 1
            total_rows += 1
            try:
                lat = float(row.get("latitude") or row.get("lat", 0))
                lng = float(row.get("longitude") or row.get("lng", 0))
                waste_type_str = (row.get("waste_type") or row.get("type", "general")).strip().lower()
                volume_str = (row.get("volume") or "medium").strip().lower()

                waste_type = WasteType(waste_type_str)
                volume = Volume(volume_str)

                req_create = PickupRequestCreate(
                    latitude=lat,
                    longitude=lng,
                    address=row.get("address"),
                    waste_type=waste_type,
                    volume=volume,
                    description=row.get("description"),
                    reporter_id=row.get("reporter_id") or "csv_import",
                    zone_id=row.get("zone_id") or None,
                )
                created = await self.create_request(req_create)
                imported_count += 1
                if len(sample_imported) < 5:
                    sample_imported.append(created)

            except Exception as e:
                errors.append(ImportRowError(row_number=row_idx, error=str(e)))

        return ImportRequestsResult(
            total_rows=total_rows,
            imported_count=imported_count,
            failed_count=len(errors),
            errors=errors,
            sample_imported=sample_imported,
        )


request_service = RequestService()


def get_request_service() -> RequestService:
    return request_service
