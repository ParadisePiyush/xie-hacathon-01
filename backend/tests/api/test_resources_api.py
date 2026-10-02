import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_depot_lifecycle_and_nearest(async_client: AsyncClient):
    # 1. Create Depot
    payload = {
        "name": "Main City Depot",
        "latitude": 19.9975,
        "longitude": 73.7898,
        "address": "Depot Road 1",
    }
    create_res = await async_client.post("/api/v1/depots", json=payload)
    assert create_res.status_code == 201
    depot_data = create_res.json()
    depot_id = depot_data["id"]
    assert depot_data["name"] == "Main City Depot"

    # 2. List Depots
    list_res = await async_client.get("/api/v1/depots")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # 3. Nearest Depot
    nearest_res = await async_client.get("/api/v1/depots/nearest?lat=19.9980&lng=73.7900")
    assert nearest_res.status_code == 200
    nearest_data = nearest_res.json()
    assert nearest_data["depot"]["id"] == depot_id
    assert nearest_data["distance_meters"] > 0

    # 4. Update Depot
    update_res = await async_client.patch(f"/api/v1/depots/{depot_id}", json={"name": "Updated Depot Name"})
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Updated Depot Name"

    # 5. Delete Depot
    del_res = await async_client.delete(f"/api/v1/depots/{depot_id}")
    assert del_res.status_code == 200


@pytest.mark.asyncio
async def test_zone_creation_and_auto_assignment(async_client: AsyncClient):
    # 1. Create Zone with polygon boundary
    zone_payload = {
        "name": "Downtown Zone",
        "color": "#EF4444",
        "boundary_coordinates": [
            [19.90, 73.70],
            [20.10, 73.70],
            [20.10, 73.90],
            [19.90, 73.90],
            [19.90, 73.70],
        ],
    }
    zone_res = await async_client.post("/api/v1/zones", json=zone_payload)
    assert zone_res.status_code == 201
    zone_id = zone_res.json()["id"]

    # 2. Create request inside zone without providing zone_id
    req_payload = {
        "latitude": 20.00,
        "longitude": 73.80,
        "waste_type": "general",
        "volume": "medium",
    }
    req_res = await async_client.post("/api/v1/requests", json=req_payload)
    assert req_res.status_code == 201
    req_data = req_res.json()
    # Verified: Point-in-Polygon automatically assigned zone_id!
    assert req_data["zone_id"] == zone_id


@pytest.mark.asyncio
async def test_teams_and_vehicles_crud(async_client: AsyncClient):
    # Create Depot
    depot_res = await async_client.post(
        "/api/v1/depots",
        json={"name": "Logistics Hub", "latitude": 20.0, "longitude": 73.8},
    )
    depot_id = depot_res.json()["id"]

    # Create Team
    team_res = await async_client.post(
        "/api/v1/teams",
        json={"name": "Squad Blue", "depot_id": depot_id},
    )
    assert team_res.status_code == 201
    team_id = team_res.json()["id"]
    assert team_res.json()["depot_name"] == "Logistics Hub"

    # Create Vehicle
    veh_res = await async_client.post(
        "/api/v1/vehicles",
        json={
            "team_id": team_id,
            "plate": "MH-15-ZZ-9999",
            "capacity_units": 25,
            "shift_start": "08:00",
            "shift_end": "16:00",
        },
    )
    assert veh_res.status_code == 201
    veh_id = veh_res.json()["id"]
    assert veh_res.json()["plate"] == "MH-15-ZZ-9999"

    # List Vehicles filtered by team
    list_veh_res = await async_client.get(f"/api/v1/vehicles?team_id={team_id}")
    assert list_veh_res.status_code == 200
    assert len(list_veh_res.json()) == 1
