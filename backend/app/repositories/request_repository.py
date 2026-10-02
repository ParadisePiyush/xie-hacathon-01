from abc import abstractmethod
from typing import List, Optional, Tuple
from app.repositories.base import BaseRepository
from app.schemas.history import StatusHistoryItem
from app.schemas.request import (
    PickupRequestResponse,
    PriorityBand,
    RequestStatus,
    WasteType,
)


class RequestRepository(BaseRepository[PickupRequestResponse]):
    """Abstract protocol for pickup requests and their audit history."""

    @abstractmethod
    async def list_requests(
        self,
        status: Optional[RequestStatus] = None,
        waste_type: Optional[WasteType] = None,
        priority_band: Optional[PriorityBand] = None,
        zone_id: Optional[str] = None,
        reporter_id: Optional[str] = None,
        bbox: Optional[Tuple[float, float, float, float]] = None,  # min_lat, min_lng, max_lat, max_lng
        search: Optional[str] = None,
        sort_by: str = "priority_score",
        sort_order: str = "desc",
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[PickupRequestResponse], int]:
        """Returns filtered list of requests and total count matching filters."""
        pass

    @abstractmethod
    async def add_history(self, history: StatusHistoryItem) -> StatusHistoryItem:
        pass

    @abstractmethod
    async def get_history(self, request_id: str) -> List[StatusHistoryItem]:
        pass

    @abstractmethod
    async def find_nearby(
        self,
        latitude: float,
        longitude: float,
        radius_meters: float,
        statuses: Optional[List[RequestStatus]] = None,
    ) -> List[Tuple[PickupRequestResponse, float]]:
        """Returns list of (request, distance_meters) within given radius."""
        pass

    @abstractmethod
    async def count_nearby_open(
        self,
        latitude: float,
        longitude: float,
        radius_meters: float,
        exclude_id: Optional[str] = None,
    ) -> int:
        """Counts other open/active requests within radius for repeat report factor."""
        pass

    @abstractmethod
    async def find_duplicate_candidate(
        self,
        latitude: float,
        longitude: float,
        waste_type: WasteType,
        radius_meters: float = 50.0,
        max_age_hours: float = 24.0,
    ) -> Optional[PickupRequestResponse]:
        """Finds open request of identical waste type within proximity and age window."""
        pass
