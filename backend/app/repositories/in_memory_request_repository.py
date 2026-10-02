import asyncio
import math
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from app.repositories.request_repository import RequestRepository
from app.schemas.history import StatusHistoryItem
from app.schemas.request import (
    PickupRequestResponse,
    PriorityBand,
    RequestStatus,
    WasteType,
)


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two GPS points in meters."""
    radius_earth_m = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return radius_earth_m * c


class InMemoryRequestRepository(RequestRepository):
    """In-memory thread-safe implementation of RequestRepository for Phase 1 testing and development."""

    def __init__(self):
        self._requests: Dict[str, PickupRequestResponse] = {}
        self._histories: Dict[str, List[StatusHistoryItem]] = {}
        self._lock = asyncio.Lock()

    async def get_by_id(self, item_id: str) -> Optional[PickupRequestResponse]:
        async with self._lock:
            req = self._requests.get(item_id)
            if not req:
                return None
            # Return copy with loaded history
            history = self._histories.get(item_id, [])
            return req.model_copy(update={"history": list(history)})

    async def create(self, item: PickupRequestResponse) -> PickupRequestResponse:
        async with self._lock:
            self._requests[item.id] = item
            if item.id not in self._histories:
                self._histories[item.id] = []
            return item

    async def update(self, item_id: str, updates: dict) -> Optional[PickupRequestResponse]:
        async with self._lock:
            current = self._requests.get(item_id)
            if not current:
                return None
            updated = current.model_copy(update=updates)
            self._requests[item_id] = updated
            history = self._histories.get(item_id, [])
            return updated.model_copy(update={"history": list(history)})

    async def delete(self, item_id: str) -> bool:
        async with self._lock:
            if item_id in self._requests:
                del self._requests[item_id]
                self._histories.pop(item_id, None)
                return True
            return False

    async def add_history(self, history: StatusHistoryItem) -> StatusHistoryItem:
        async with self._lock:
            if history.request_id not in self._histories:
                self._histories[history.request_id] = []
            self._histories[history.request_id].append(history)

            # Update the stored request object's history snapshot as well
            if history.request_id in self._requests:
                req = self._requests[history.request_id]
                self._requests[history.request_id] = req.model_copy(
                    update={"history": list(self._histories[history.request_id])}
                )
            return history

    async def get_history(self, request_id: str) -> List[StatusHistoryItem]:
        async with self._lock:
            return list(self._histories.get(request_id, []))

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
        async with self._lock:
            results = list(self._requests.values())

        # Filtering
        if status:
            results = [r for r in results if r.status == status]
        if waste_type:
            results = [r for r in results if r.waste_type == waste_type]
        if priority_band:
            results = [r for r in results if r.priority_band == priority_band]
        if zone_id:
            results = [r for r in results if r.zone_id == zone_id]
        if reporter_id:
            results = [r for r in results if r.reporter_id == reporter_id]
        if bbox:
            min_lat, min_lng, max_lat, max_lng = bbox
            results = [
                r
                for r in results
                if min_lat <= r.latitude <= max_lat and min_lng <= r.longitude <= max_lng
            ]
        if search:
            query = search.lower()
            results = [
                r
                for r in results
                if (r.address and query in r.address.lower())
                or (r.description and query in r.description.lower())
                or query in r.id.lower()
            ]

        # Sorting
        reverse = sort_order.lower() == "desc"
        if sort_by == "priority_score":
            results.sort(key=lambda x: x.priority_score, reverse=reverse)
        elif sort_by == "created_at":
            results.sort(key=lambda x: x.created_at, reverse=reverse)
        elif sort_by == "updated_at":
            results.sort(key=lambda x: x.updated_at, reverse=reverse)
        elif sort_by == "sla_due_at":
            results.sort(key=lambda x: (x.sla_due_at or datetime.max), reverse=reverse)
        else:
            results.sort(key=lambda x: x.priority_score, reverse=reverse)

        total = len(results)
        paginated = results[skip : skip + limit]

        # Attach history copy
        items_with_history = []
        for r in paginated:
            h = self._histories.get(r.id, [])
            items_with_history.append(r.model_copy(update={"history": list(h)}))

        return items_with_history, total

    async def find_nearby(
        self,
        latitude: float,
        longitude: float,
        radius_meters: float,
        statuses: Optional[List[RequestStatus]] = None,
    ) -> List[Tuple[PickupRequestResponse, float]]:
        async with self._lock:
            all_reqs = list(self._requests.values())

        matching: List[Tuple[PickupRequestResponse, float]] = []
        for req in all_reqs:
            if statuses and req.status not in statuses:
                continue
            distance = haversine_distance_meters(
                latitude, longitude, req.latitude, req.longitude
            )
            if distance <= radius_meters:
                h = self._histories.get(req.id, [])
                matching.append((req.model_copy(update={"history": list(h)}), round(distance, 1)))

        # Sort by closest distance first
        matching.sort(key=lambda item: item[1])
        return matching

    async def count_nearby_open(
        self,
        latitude: float,
        longitude: float,
        radius_meters: float,
        exclude_id: Optional[str] = None,
    ) -> int:
        open_statuses = {
            RequestStatus.SUBMITTED,
            RequestStatus.VERIFIED,
            RequestStatus.PLANNED,
            RequestStatus.IN_PROGRESS,
            RequestStatus.SKIPPED,
        }
        async with self._lock:
            reqs = list(self._requests.values())

        count = 0
        for r in reqs:
            if exclude_id and r.id == exclude_id:
                continue
            if r.status in open_statuses:
                dist = haversine_distance_meters(latitude, longitude, r.latitude, r.longitude)
                if dist <= radius_meters:
                    count += 1
        return count


# Singleton instance for in-memory Phase 1
in_memory_repository = InMemoryRequestRepository()


def get_request_repository() -> RequestRepository:
    return in_memory_repository
