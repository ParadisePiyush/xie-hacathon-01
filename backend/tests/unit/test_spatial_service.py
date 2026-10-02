from datetime import datetime, timezone
from app.schemas.resource import DepotResponse, ZoneResponse
from app.services.spatial_service import haversine_distance, spatial_service


def test_haversine_distance_computation():
    # Distance between ~same points
    d_zero = haversine_distance(19.9975, 73.7898, 19.9975, 73.7898)
    assert d_zero == 0.0

    # Approx distance for 0.001 deg lat difference (~111 meters)
    d = haversine_distance(19.9975, 73.7898, 19.9985, 73.7898)
    assert 100.0 < d < 120.0


def test_point_in_polygon_detection():
    # Polygon around [20.0, 73.8]
    poly_coords = [
        [19.9, 73.7],
        [20.1, 73.7],
        [20.1, 73.9],
        [19.9, 73.9],
        [19.9, 73.7],
    ]

    # Inside point
    assert spatial_service.is_point_in_polygon(20.0, 73.8, poly_coords) is True

    # Outside point
    assert spatial_service.is_point_in_polygon(20.5, 74.5, poly_coords) is False


def test_zone_assignment_for_point():
    zone1 = ZoneResponse(
        id="zone-1",
        name="Zone 1",
        boundary_coordinates=[
            [19.9, 73.7],
            [20.0, 73.7],
            [20.0, 73.8],
            [19.9, 73.8],
            [19.9, 73.7],
        ],
        created_at=datetime.now(timezone.utc),
    )
    zone2 = ZoneResponse(
        id="zone-2",
        name="Zone 2",
        boundary_coordinates=[
            [20.0, 73.8],
            [20.1, 73.8],
            [20.1, 73.9],
            [20.0, 73.9],
            [20.0, 73.8],
        ],
        created_at=datetime.now(timezone.utc),
    )

    # Point in zone 1
    assert spatial_service.assign_zone_for_point(19.95, 73.75, [zone1, zone2]) == "zone-1"

    # Point in zone 2
    assert spatial_service.assign_zone_for_point(20.05, 73.85, [zone1, zone2]) == "zone-2"

    # Point outside both
    assert spatial_service.assign_zone_for_point(21.0, 75.0, [zone1, zone2]) is None


def test_find_nearest_depot():
    depot_a = DepotResponse(
        id="depot-a",
        name="Depot A",
        latitude=19.9975,
        longitude=73.7898,
        created_at=datetime.now(timezone.utc),
    )
    depot_b = DepotResponse(
        id="depot-b",
        name="Depot B",
        latitude=20.0500,
        longitude=73.8500,
        created_at=datetime.now(timezone.utc),
    )

    # Coordinates very close to depot A
    result = spatial_service.find_nearest_depot(19.9976, 73.7899, [depot_a, depot_b])
    assert result is not None
    nearest, dist = result
    assert nearest.id == "depot-a"
    assert dist < 50.0
