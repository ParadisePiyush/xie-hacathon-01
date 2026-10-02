from typing import List
from fastapi import APIRouter, Depends, status

from app.core.exceptions import NotFoundException
from app.repositories.resource_repository import InMemoryResourceRepository, get_resource_repository
from app.schemas.resource import ZoneCreate, ZoneResponse, ZoneUpdate

router = APIRouter(prefix="/zones", tags=["Zones"])


@router.post("", response_model=ZoneResponse, status_code=status.HTTP_201_CREATED)
async def create_zone(
    payload: ZoneCreate,
    repo: InMemoryResourceRepository = Depends(get_resource_repository),
):
    return await repo.create_zone(payload)


@router.get("", response_model=List[ZoneResponse])
async def list_zones(
    repo: InMemoryResourceRepository = Depends(get_resource_repository),
):
    return await repo.list_zones()


@router.get("/{id}", response_model=ZoneResponse)
async def get_zone(
    id: str,
    repo: InMemoryResourceRepository = Depends(get_resource_repository),
):
    zone = await repo.get_zone(id)
    if not zone:
        raise NotFoundException(message=f"Zone '{id}' not found")
    return zone


@router.patch("/{id}", response_model=ZoneResponse)
async def update_zone(
    id: str,
    payload: ZoneUpdate,
    repo: InMemoryResourceRepository = Depends(get_resource_repository),
):
    updated = await repo.update_zone(id, payload)
    if not updated:
        raise NotFoundException(message=f"Zone '{id}' not found")
    return updated


@router.delete("/{id}")
async def delete_zone(
    id: str,
    repo: InMemoryResourceRepository = Depends(get_resource_repository),
):
    deleted = await repo.delete_zone(id)
    if not deleted:
        raise NotFoundException(message=f"Zone '{id}' not found")
    return {"message": "Zone deleted successfully", "id": id}
