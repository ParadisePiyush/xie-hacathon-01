from datetime import datetime, timezone
import pytest
from app.optimizer.distance_matrix import DistanceMatrixService
from app.optimizer.vrp_solver import VRPOptimizer
from app.schemas.request import PickupRequestResponse, PriorityBand, RequestStatus, Volume, WasteType
from app.schemas.resource import VehicleResponse


@pytest.mark.asyncio
async def test_distance_matrix_service():
    srv = DistanceMatrixService()
    coords = [(19.9975, 73.7898), (20.0100, 73.8100), (19.9920, 73.7850)]
    dist_mat, dur_mat = await srv.compute_matrix(coords)

    assert len(dist_mat) == 3
    assert len(dur_mat) == 3
    assert dist_mat[0][0] == 0.0
    assert dist_mat[0][1] > 0.0
    assert dur_mat[0][1] > 0.0


def test_vrp_solver_prioritizes_critical_and_respects_capacity():
    now = datetime.now(timezone.utc)
    depot_coord = (19.9975, 73.7898)

    # 1. Critical request with high score
    req_critical = PickupRequestResponse(
        id="req-crit-1",
        latitude=19.9980,
        longitude=73.7905,
        waste_type=WasteType.HAZARDOUS,
        volume=Volume.OVERFLOW,  # demand = 6
        status=RequestStatus.VERIFIED,
        priority_score=92.0,
        priority_band=PriorityBand.CRITICAL,
        repeat_count=2,
        created_at=now,
        updated_at=now,
    )

    # 2. Medium request
    req_medium = PickupRequestResponse(
        id="req-med-2",
        latitude=19.9960,
        longitude=73.7880,
        waste_type=WasteType.GENERAL,
        volume=Volume.MEDIUM,  # demand = 2
        status=RequestStatus.VERIFIED,
        priority_score=45.0,
        priority_band=PriorityBand.MEDIUM,
        repeat_count=0,
        created_at=now,
        updated_at=now,
    )

    # 3. Low request
    req_low = PickupRequestResponse(
        id="req-low-3",
        latitude=20.0050,
        longitude=73.8000,
        waste_type=WasteType.RECYCLABLE,
        volume=Volume.SMALL,  # demand = 1
        status=RequestStatus.VERIFIED,
        priority_score=15.0,
        priority_band=PriorityBand.LOW,
        repeat_count=0,
        created_at=now,
        updated_at=now,
    )

    vehicle = VehicleResponse(
        id="veh-1",
        plate="MH-15-OP-1111",
        capacity_units=10,  # Can hold demands (6 + 2 + 1 = 9 <= 10)
        shift_start="08:00",
        shift_end="17:00",
        is_active=True,
        created_at=now,
    )

    # Simple 4x4 matrix (depot, req_critical, req_medium, req_low)
    dist_matrix = [
        [0, 500, 400, 1500],
        [500, 0, 600, 1200],
        [400, 600, 0, 1600],
        [1500, 1200, 1600, 0],
    ]
    dur_matrix = [
        [0, 100, 80, 300],
        [100, 0, 120, 240],
        [80, 120, 0, 320],
        [300, 240, 320, 0],
    ]

    solved = VRPOptimizer.solve(
        depot_coord=depot_coord,
        depot_name="Test Depot",
        requests=[req_critical, req_medium, req_low],
        vehicles=[vehicle],
        distance_matrix=dist_matrix,
        duration_matrix=dur_matrix,
        plan_start_time=now,
        time_limit_seconds=3,
    )

    assert len(solved.routes) == 1
    route = solved.routes[0]
    # Check that Critical stop is served
    served_ids = [s.request.id for s in route.stops]
    assert "req-crit-1" in served_ids
    # Check capacity not exceeded
    assert route.total_volume_units <= vehicle.capacity_units
    # Check route has positive distance
    assert route.total_distance_m > 0
