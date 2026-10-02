from typing import List
from fastapi import APIRouter, Depends, Query, status

from app.core.exceptions import NotFoundException
from app.repositories.resource_repository import InMemoryResourceRepository, get_resource_repository
from app.schemas.resource import DepotCreate, DepotResponse, DepotUpdate, NearestDepotResponse
from app.services.spatial_service import spatial_service

router = APIRouter(prefix="/depots", tags=["Depots"])


@router.post("", response_model=DepotResponse, status_code=status.HTTP_201_CREATED)
async def create_depot(
    payload: DepotCreate,
    repo: InMemoryResourceRepository = Depends(get_resource_repository),
):
    return await repo.create_depot(payload)


@router.get("", response_model=List[DepotResponse])
async def list_depots(
    repo: InMemoryResourceRepository = Depends(get_resource_repository),
):
    return await repo.list_depots()


@router.get("/nearest", response_model=NearestDepotResponse)
async def get_nearest_depot(
    lat: float = Query(..., ge=-90.0, le=90.0),
    lng: float = Query(..., ge=-180.0, le=180.0),
    repo: InMemoryResourceRepository = Depends(get_resource_repository),
):
    depots = await repo.list_depots()
    result = spatial_service.find_nearest_depot(lat, lng, depots)
    if not result:
        raise NotFoundException(message="No depots registered in the system")
    nearest, dist = result
    return NearestDepotResponse(depot=nearest, distance_meters=dist)


@router.get("/{id}", response_model=DepotResponse)
async def get_depot(
    id: str,
    repo: InMemoryResourceRepository = Depends(get_resource_repository),
):
    depot = await repo.get_depot(id)
    if not depot:
        raise NotFoundException(message=f"Depot '{id}' not found")
    return depot


@router.patch("/{id}", response_model=DepotResponse)
async def update_depot(
    id: str,
    payload: DepotUpdate,
    repo: InMemoryResourceRepository = Depends(get_resource_repository),
):
    updated = await repo.update_depot(id, payload)
    if not updated:
        raise NotFoundException(message=f"Depot '{id}' not found")
    return updated


@router.delete("/{id}")
async def delete_depot(
    id: str,
    repo: InMemoryResourceRepository = Depends(get_resource_repository),
):
    deleted = await repo.delete_depot(id)
    if not deleted:
        raise NotFoundException(message=f"Depot '{id}' not found")
    return {"message": "Depot deleted successfully", "id": id}
