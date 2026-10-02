import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_pickup_request(async_client: AsyncClient):
    payload = {
        "latitude": 19.9975,
        "longitude": 73.7898,
        "address": "Market Yard Gate 2",
        "waste_type": "hazardous",
        "volume": "large",
        "description": "Chemical residue drums",
        "reporter_id": "citizen_42",
    }
    response = await async_client.post("/api/v1/requests", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["id"] is not None
    assert data["waste_type"] == "hazardous"
    assert data["volume"] == "large"
    assert data["status"] == "submitted"
    assert data["priority_score"] > 0
    assert data["priority_band"] in ["critical", "high", "medium", "low"]
    assert len(data["history"]) >= 1
    assert data["history"][0]["to_status"] == "submitted"


@pytest.mark.asyncio
async def test_create_pickup_request_validation_error(async_client: AsyncClient):
    # Invalid latitude > 90
    payload = {
        "latitude": 120.0,
        "longitude": 73.7898,
        "waste_type": "hazardous",
        "volume": "large",
    }
    response = await async_client.post("/api/v1/requests", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_list_and_filter_requests(async_client: AsyncClient):
    # Create 2 requests
    req1 = {
        "latitude": 19.9975,
        "longitude": 73.7898,
        "waste_type": "hazardous",
        "volume": "overflow",
    }
    req2 = {
        "latitude": 19.9910,
        "longitude": 73.7820,
        "waste_type": "recyclable",
        "volume": "small",
    }
    await async_client.post("/api/v1/requests", json=req1)
    await async_client.post("/api/v1/requests", json=req2)

    # List all
    list_res = await async_client.get("/api/v1/requests")
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["total"] == 2
    assert len(list_data["items"]) == 2

    # Filter by waste type
    filter_res = await async_client.get("/api/v1/requests?type=hazardous")
    assert filter_res.status_code == 200
    filtered_data = filter_res.json()
    assert filtered_data["total"] == 1
    assert filtered_data["items"][0]["waste_type"] == "hazardous"


@pytest.mark.asyncio
async def test_get_request_by_id_and_not_found(async_client: AsyncClient):
    req_payload = {
        "latitude": 19.9975,
        "longitude": 73.7898,
        "waste_type": "general",
        "volume": "medium",
    }
    create_res = await async_client.post("/api/v1/requests", json=req_payload)
    req_id = create_res.json()["id"]

    # Get valid
    get_res = await async_client.get(f"/api/v1/requests/{req_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == req_id

    # Get nonexistent
    not_found_res = await async_client.get("/api/v1/requests/nonexistent-id")
    assert not_found_res.status_code == 404
    error_data = not_found_res.json()
    assert error_data["error"]["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_transition_request_lifecycle(async_client: AsyncClient):
    create_res = await async_client.post(
        "/api/v1/requests",
        json={
            "latitude": 19.9975,
            "longitude": 73.7898,
            "waste_type": "medical",
            "volume": "large",
        },
    )
    req_id = create_res.json()["id"]

    # Transition SUBMITTED -> VERIFIED
    verify_res = await async_client.post(
        f"/api/v1/requests/{req_id}/transition",
        json={"to_status": "verified", "note": "Verified by dispatcher 01"},
    )
    assert verify_res.status_code == 200
    assert verify_res.json()["status"] == "verified"

    # Transition VERIFIED -> PLANNED
    plan_res = await async_client.post(
        f"/api/v1/requests/{req_id}/transition",
        json={"to_status": "planned", "note": "Assigned to morning route"},
    )
    assert plan_res.status_code == 200
    assert plan_res.json()["status"] == "planned"

    # Invalid transition PLANNED -> SUBMITTED (must return 409 Conflict)
    invalid_res = await async_client.post(
        f"/api/v1/requests/{req_id}/transition",
        json={"to_status": "submitted"},
    )
    assert invalid_res.status_code == 409
    error_data = invalid_res.json()
    assert error_data["error"]["code"] == "INVALID_STATE_TRANSITION"


@pytest.mark.asyncio
async def test_nearby_requests_spatial_search(async_client: AsyncClient):
    # Base location
    base_lat = 19.9975
    base_lng = 73.7898

    # 1. Close request (~100m away)
    await async_client.post(
        "/api/v1/requests",
        json={
            "latitude": 19.9980,
            "longitude": 73.7905,
            "waste_type": "general",
            "volume": "medium",
        },
    )

    # 2. Far request (~10km away)
    await async_client.post(
        "/api/v1/requests",
        json={
            "latitude": 20.0800,
            "longitude": 73.8500,
            "waste_type": "general",
            "volume": "medium",
        },
    )

    # Search within 500m
    nearby_res = await async_client.get(
        f"/api/v1/requests/nearby?lat={base_lat}&lng={base_lng}&radius=500"
    )
    assert nearby_res.status_code == 200
    items = nearby_res.json()
    assert len(items) == 1
    assert items[0]["distance_meters"] <= 500.0


@pytest.mark.asyncio
async def test_cancel_request(async_client: AsyncClient):
    create_res = await async_client.post(
        "/api/v1/requests",
        json={
            "latitude": 19.9975,
            "longitude": 73.7898,
            "waste_type": "general",
            "volume": "medium",
        },
    )
    req_id = create_res.json()["id"]

    cancel_res = await async_client.delete(
        f"/api/v1/requests/{req_id}?reason=Citizen+mistake"
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelled"


@pytest.mark.asyncio
async def test_priority_config_api(async_client: AsyncClient):
    # Get initial config
    get_res = await async_client.get("/api/v1/config/priority")
    assert get_res.status_code == 200
    config_data = get_res.json()
    assert config_data["weights"]["w_hazard"] == 0.35

    # Update config
    update_payload = {
        "weights": {
            "w_hazard": 0.40,
            "w_age": 0.20,
            "w_volume": 0.15,
            "w_repeat": 0.10,
            "w_sla_risk": 0.15,
        },
        "max_sla_hours": 36.0,
        "repeat_radius_meters": 60.0,
        "repeat_saturation_count": 4,
    }
    put_res = await async_client.put("/api/v1/config/priority", json=update_payload)
    assert put_res.status_code == 200
    updated_data = put_res.json()
    assert updated_data["weights"]["w_hazard"] == 0.40
    assert updated_data["max_sla_hours"] == 36.0
