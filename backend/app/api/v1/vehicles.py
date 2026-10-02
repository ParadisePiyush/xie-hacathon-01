from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status

from app.core.exceptions import NotFoundException
from app.repositories.resource_repository import InMemoryResourceRepository, get_resource_repository
from app.schemas.resource import VehicleCreate, VehicleResponse, VehicleUpdate

router = APIRouter(prefix="/vehicles", tags=["Vehicles"])


@router.post("", response_model=VehicleResponse, status_code=status.HTTP_201_CREATED)
async def create_vehicle(
    payload: VehicleCreate,
    repo: InMemoryResourceRepository = Depends(get_resource_repository),
):
    if payload.team_id:
        team = await repo.get_team(payload.team_id)
        if not team:
            raise NotFoundException(message=f"Team '{payload.team_id}' not found")
    return await repo.create_vehicle(payload)


@router.get("", response_model=List[VehicleResponse])
async def list_vehicles(
    team_id: Optional[str] = Query(None, description="Filter vehicles by team"),
    repo: InMemoryResourceRepository = Depends(get_resource_repository),
):
    return await repo.list_vehicles(team_id=team_id)


@router.get("/{id}", response_model=VehicleResponse)
async def get_vehicle(
    id: str,
    repo: InMemoryResourceRepository = Depends(get_resource_repository),
):
    vehicle = await repo.get_vehicle(id)
    if not vehicle:
        raise NotFoundException(message=f"Vehicle '{id}' not found")
    return vehicle


@router.patch("/{id}", response_model=VehicleResponse)
async def update_vehicle(
    id: str,
    payload: VehicleUpdate,
    repo: InMemoryResourceRepository = Depends(get_resource_repository),
):
    if payload.team_id:
        team = await repo.get_team(payload.team_id)
        if not team:
            raise NotFoundException(message=f"Team '{payload.team_id}' not found")
    updated = await repo.update_vehicle(id, payload)
    if not updated:
        raise NotFoundException(message=f"Vehicle '{id}' not found")
    return updated


@router.delete("/{id}")
async def delete_vehicle(
    id: str,
    repo: InMemoryResourceRepository = Depends(get_resource_repository),
):
    deleted = await repo.delete_vehicle(id)
    if not deleted:
        raise NotFoundException(message=f"Vehicle '{id}' not found")
    return {"message": "Vehicle deleted successfully", "id": id}
