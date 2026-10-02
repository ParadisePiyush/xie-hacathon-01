import asyncio
from datetime import datetime, timezone
from typing import Dict, List, Optional
import uuid

from app.schemas.resource import (
    DepotCreate,
    DepotResponse,
    DepotUpdate,
    TeamCreate,
    TeamResponse,
    TeamUpdate,
    VehicleCreate,
    VehicleResponse,
    VehicleUpdate,
    ZoneCreate,
    ZoneResponse,
    ZoneUpdate,
)


class InMemoryResourceRepository:
    """Manages Depots, Zones, Teams, and Vehicles."""

    def __init__(self):
        self._depots: Dict[str, DepotResponse] = {}
        self._zones: Dict[str, ZoneResponse] = {}
        self._teams: Dict[str, TeamResponse] = {}
        self._vehicles: Dict[str, VehicleResponse] = {}
        self._lock = asyncio.Lock()

    # --- Depots ---
    async def create_depot(self, data: DepotCreate) -> DepotResponse:
        async with self._lock:
            depot_id = str(uuid.uuid4())
            depot = DepotResponse(
                id=depot_id,
                name=data.name,
                latitude=data.latitude,
                longitude=data.longitude,
                address=data.address,
                created_at=datetime.now(timezone.utc),
            )
            self._depots[depot_id] = depot
            return depot

    async def get_depot(self, depot_id: str) -> Optional[DepotResponse]:
        async with self._lock:
            return self._depots.get(depot_id)

    async def list_depots(self) -> List[DepotResponse]:
        async with self._lock:
            return list(self._depots.values())

    async def update_depot(self, depot_id: str, data: DepotUpdate) -> Optional[DepotResponse]:
        async with self._lock:
            existing = self._depots.get(depot_id)
            if not existing:
                return None
            updates = data.model_dump(exclude_unset=True)
            updated = existing.model_copy(update=updates)
            self._depots[depot_id] = updated
            return updated

    async def delete_depot(self, depot_id: str) -> bool:
        async with self._lock:
            if depot_id in self._depots:
                del self._depots[depot_id]
                return True
            return False

    # --- Zones ---
    async def create_zone(self, data: ZoneCreate) -> ZoneResponse:
        async with self._lock:
            zone_id = str(uuid.uuid4())
            zone = ZoneResponse(
                id=zone_id,
                name=data.name,
                color=data.color or "#3B82F6",
                boundary_coordinates=data.boundary_coordinates,
                created_at=datetime.now(timezone.utc),
            )
            self._zones[zone_id] = zone
            return zone

    async def get_zone(self, zone_id: str) -> Optional[ZoneResponse]:
        async with self._lock:
            return self._zones.get(zone_id)

    async def list_zones(self) -> List[ZoneResponse]:
        async with self._lock:
            return list(self._zones.values())

    async def update_zone(self, zone_id: str, data: ZoneUpdate) -> Optional[ZoneResponse]:
        async with self._lock:
            existing = self._zones.get(zone_id)
            if not existing:
                return None
            updates = data.model_dump(exclude_unset=True)
            updated = existing.model_copy(update=updates)
            self._zones[zone_id] = updated
            return updated

    async def delete_zone(self, zone_id: str) -> bool:
        async with self._lock:
            if zone_id in self._zones:
                del self._zones[zone_id]
                return True
            return False

    # --- Teams ---
    async def create_team(self, data: TeamCreate) -> TeamResponse:
        async with self._lock:
            team_id = str(uuid.uuid4())
            depot_name = None
            if data.depot_id and data.depot_id in self._depots:
                depot_name = self._depots[data.depot_id].name

            team = TeamResponse(
                id=team_id,
                name=data.name,
                depot_id=data.depot_id,
                depot_name=depot_name,
                created_at=datetime.now(timezone.utc),
            )
            self._teams[team_id] = team
            return team

    async def get_team(self, team_id: str) -> Optional[TeamResponse]:
        async with self._lock:
            team = self._teams.get(team_id)
            if team and team.depot_id and team.depot_id in self._depots:
                team = team.model_copy(update={"depot_name": self._depots[team.depot_id].name})
            return team

    async def list_teams(self) -> List[TeamResponse]:
        async with self._lock:
            res = []
            for t in self._teams.values():
                dname = self._depots[t.depot_id].name if t.depot_id and t.depot_id in self._depots else None
                res.append(t.model_copy(update={"depot_name": dname}))
            return res

    async def update_team(self, team_id: str, data: TeamUpdate) -> Optional[TeamResponse]:
        async with self._lock:
            existing = self._teams.get(team_id)
            if not existing:
                return None
            updates = data.model_dump(exclude_unset=True)
            if "depot_id" in updates:
                depot_id = updates["depot_id"]
                updates["depot_name"] = self._depots[depot_id].name if depot_id and depot_id in self._depots else None
            updated = existing.model_copy(update=updates)
            self._teams[team_id] = updated
            return updated

    async def delete_team(self, team_id: str) -> bool:
        async with self._lock:
            if team_id in self._teams:
                del self._teams[team_id]
                return True
            return False

    # --- Vehicles ---
    async def create_vehicle(self, data: VehicleCreate) -> VehicleResponse:
        async with self._lock:
            veh_id = str(uuid.uuid4())
            team_name = None
            if data.team_id and data.team_id in self._teams:
                team_name = self._teams[data.team_id].name

            vehicle = VehicleResponse(
                id=veh_id,
                team_id=data.team_id,
                team_name=team_name,
                plate=data.plate,
                capacity_units=data.capacity_units,
                shift_start=data.shift_start,
                shift_end=data.shift_end,
                is_active=data.is_active,
                created_at=datetime.now(timezone.utc),
            )
            self._vehicles[veh_id] = vehicle
            return vehicle

    async def get_vehicle(self, vehicle_id: str) -> Optional[VehicleResponse]:
        async with self._lock:
            veh = self._vehicles.get(vehicle_id)
            if veh and veh.team_id and veh.team_id in self._teams:
                veh = veh.model_copy(update={"team_name": self._teams[veh.team_id].name})
            return veh

    async def list_vehicles(self, team_id: Optional[str] = None) -> List[VehicleResponse]:
        async with self._lock:
            res = []
            for v in self._vehicles.values():
                if team_id and v.team_id != team_id:
                    continue
                tname = self._teams[v.team_id].name if v.team_id and v.team_id in self._teams else None
                res.append(v.model_copy(update={"team_name": tname}))
            return res

    async def update_vehicle(self, vehicle_id: str, data: VehicleUpdate) -> Optional[VehicleResponse]:
        async with self._lock:
            existing = self._vehicles.get(vehicle_id)
            if not existing:
                return None
            updates = data.model_dump(exclude_unset=True)
            if "team_id" in updates:
                tid = updates["team_id"]
                updates["team_name"] = self._teams[tid].name if tid and tid in self._teams else None
            updated = existing.model_copy(update=updates)
            self._vehicles[vehicle_id] = updated
            return updated

    async def delete_vehicle(self, vehicle_id: str) -> bool:
        async with self._lock:
            if vehicle_id in self._vehicles:
                del self._vehicles[vehicle_id]
                return True
            return False


resource_repository = InMemoryResourceRepository()


def get_resource_repository() -> InMemoryResourceRepository:
    return resource_repository
