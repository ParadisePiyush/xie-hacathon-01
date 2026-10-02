import pytest
from app.repositories.in_memory_request_repository import in_memory_repository
from app.schemas.request import PickupRequestCreate, Volume, WasteType
from app.services.request_service import RequestService


@pytest.mark.asyncio
async def test_duplicate_detection_links_and_escalates_priority():
    service = RequestService(repository=in_memory_repository)

    # 1. First report
    req1_payload = PickupRequestCreate(
        latitude=19.99750,
        longitude=73.78980,
        waste_type=WasteType.HAZARDOUS,
        volume=Volume.MEDIUM,
        description="First report of chemical waste",
    )
    req1 = await service.create_request(req1_payload)
    assert req1.duplicate_of is None
    assert req1.repeat_count == 0
    initial_score = req1.priority_score

    # 2. Second report ~20 meters away, same waste type
    req2_payload = PickupRequestCreate(
        latitude=19.99760,
        longitude=73.78985,
        waste_type=WasteType.HAZARDOUS,
        volume=Volume.MEDIUM,
        description="Second report near the same corner",
    )
    req2 = await service.create_request(req2_payload)

    # Check that req2 is linked as duplicate of req1
    assert req2.duplicate_of == req1.id

    # Check that req1 was escalated
    updated_req1 = await service.get_request(req1.id)
    assert updated_req1.repeat_count >= 1
    assert updated_req1.priority_score > initial_score


@pytest.mark.asyncio
async def test_different_waste_type_not_duplicate():
    service = RequestService(repository=in_memory_repository)

    req1_payload = PickupRequestCreate(
        latitude=19.99750,
        longitude=73.78980,
        waste_type=WasteType.HAZARDOUS,
        volume=Volume.MEDIUM,
    )
    req1 = await service.create_request(req1_payload)

    # Different waste type at same location
    req2_payload = PickupRequestCreate(
        latitude=19.99750,
        longitude=73.78980,
        waste_type=WasteType.RECYCLABLE,
        volume=Volume.MEDIUM,
    )
    req2 = await service.create_request(req2_payload)

    assert req2.duplicate_of is None


@pytest.mark.asyncio
async def test_far_location_not_duplicate():
    service = RequestService(repository=in_memory_repository)

    req1_payload = PickupRequestCreate(
        latitude=19.99750,
        longitude=73.78980,
        waste_type=WasteType.HAZARDOUS,
        volume=Volume.MEDIUM,
    )
    req1 = await service.create_request(req1_payload)

    # 5 km away
    req2_payload = PickupRequestCreate(
        latitude=20.04000,
        longitude=73.84000,
        waste_type=WasteType.HAZARDOUS,
        volume=Volume.MEDIUM,
    )
    req2 = await service.create_request(req2_payload)

    assert req2.duplicate_of is None
