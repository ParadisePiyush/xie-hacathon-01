import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_full_planning_and_dispatch_lifecycle(async_client: AsyncClient):
    # 1. Create Depot
    depot_res = await async_client.post(
        "/api/v1/depots",
        json={"name": "Central Depot", "latitude": 19.9975, "longitude": 73.7898},
    )
    depot_id = depot_res.json()["id"]

    # 2. Create Vehicle
    veh_res = await async_client.post(
        "/api/v1/vehicles",
        json={
            "plate": "MH-15-EV-0001",
            "capacity_units": 20,
            "shift_start": "08:00",
            "shift_end": "17:00",
            "is_active": True,
        },
    )
    vehicle_id = veh_res.json()["id"]

    # 3. Create 2 Verified Requests
    req1 = await async_client.post(
        "/api/v1/requests",
        json={
            "latitude": 19.9990,
            "longitude": 73.7910,
            "waste_type": "hazardous",
            "volume": "large",
            "description": "Hazardous drums",
        },
    )
    req1_id = req1.json()["id"]

    req2 = await async_client.post(
        "/api/v1/requests",
        json={
            "latitude": 19.9950,
            "longitude": 73.7880,
            "waste_type": "general",
            "volume": "medium",
            "description": "Overflowing bin",
        },
    )
    req2_id = req2.json()["id"]

    # 4. Generate Plan
    gen_payload = {
        "depot_id": depot_id,
        "vehicle_ids": [vehicle_id],
        "request_ids": [req1_id, req2_id],
    }
    plan_res = await async_client.post("/api/v1/plans/generate", json=gen_payload)
    assert plan_res.status_code == 201
    plan_data = plan_res.json()
    assert plan_data["id"] is not None
    assert plan_data["status"] == "draft"
    assert len(plan_data["routes"]) == 1
    assert len(plan_data["routes"][0]["stops"]) == 2

    stop1 = plan_data["routes"][0]["stops"][0]
    stop_id = stop1["id"]
    assigned_req_id = stop1["request_id"]

    # Verify request transitioned to planned
    req_check = await async_client.get(f"/api/v1/requests/{assigned_req_id}")
    assert req_check.status_code == 200
    assert req_check.json()["status"] == "planned"

    # 5. Publish Plan
    pub_res = await async_client.post(f"/api/v1/plans/{plan_data['id']}/publish")
    assert pub_res.status_code == 200
    assert pub_res.json()["status"] == "published"

    # 6. Fetch Collector Route
    my_route_res = await async_client.get(f"/api/v1/routes/mine?vehicle_id={vehicle_id}")
    assert my_route_res.status_code == 200
    assert my_route_res.json()["vehicle_id"] == vehicle_id

    # 7. Complete Stop (Collector marks collected with proof photo)
    complete_res = await async_client.post(
        f"/api/v1/route-stops/{stop_id}/complete",
        json={
            "outcome": "collected",
            "proof_photo_url": "https://storage.example.com/proofs/stop1.jpg",
        },
    )
    assert complete_res.status_code == 200
    assert complete_res.json()["outcome"] == "collected"

    # Verify underlying request transitioned to COLLECTED
    final_req = await async_client.get(f"/api/v1/requests/{assigned_req_id}")
    assert final_req.status_code == 200
    assert final_req.json()["status"] == "collected"
