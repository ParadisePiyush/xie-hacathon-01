from typing import List
from fastapi import APIRouter, Depends, status

from app.core.exceptions import NotFoundException
from app.repositories.resource_repository import InMemoryResourceRepository, get_resource_repository
from app.schemas.resource import TeamCreate, TeamResponse, TeamUpdate

router = APIRouter(prefix="/teams", tags=["Teams"])


@router.post("", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(
    payload: TeamCreate,
    repo: InMemoryResourceRepository = Depends(get_resource_repository),
):
    if payload.depot_id:
        depot = await repo.get_depot(payload.depot_id)
        if not depot:
            raise NotFoundException(message=f"Depot '{payload.depot_id}' not found")
    return await repo.create_team(payload)


@router.get("", response_model=List[TeamResponse])
async def list_teams(
    repo: InMemoryResourceRepository = Depends(get_resource_repository),
):
    return await repo.list_teams()


@router.get("/{id}", response_model=TeamResponse)
async def get_team(
    id: str,
    repo: InMemoryResourceRepository = Depends(get_resource_repository),
):
    team = await repo.get_team(id)
    if not team:
        raise NotFoundException(message=f"Team '{id}' not found")
    return team


@router.patch("/{id}", response_model=TeamResponse)
async def update_team(
    id: str,
    payload: TeamUpdate,
    repo: InMemoryResourceRepository = Depends(get_resource_repository),
):
    if payload.depot_id:
        depot = await repo.get_depot(payload.depot_id)
        if not depot:
            raise NotFoundException(message=f"Depot '{payload.depot_id}' not found")
    updated = await repo.update_team(id, payload)
    if not updated:
        raise NotFoundException(message=f"Team '{id}' not found")
    return updated


@router.delete("/{id}")
async def delete_team(
    id: str,
    repo: InMemoryResourceRepository = Depends(get_resource_repository),
):
    deleted = await repo.delete_team(id)
    if not deleted:
        raise NotFoundException(message=f"Team '{id}' not found")
    return {"message": "Team deleted successfully", "id": id}
