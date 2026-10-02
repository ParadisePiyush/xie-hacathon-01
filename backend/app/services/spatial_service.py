import math
from typing import List, Optional, Tuple
from shapely.geometry import Point, Polygon

from app.schemas.resource import DepotResponse, ZoneResponse


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two GPS points in meters."""
    radius_earth_m = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return radius_earth_m * c


class SpatialService:
    """Provides Point-in-Polygon zone assignment, duplicate proximity checks, and nearest depot calculations."""

    @staticmethod
    def is_point_in_polygon(latitude: float, longitude: float, polygon_coords: List[List[float]]) -> bool:
        """Determines if GPS point [lat, lng] is inside polygon boundary coordinates.
        polygon_coords is expected to be a list of [lat, lng] coordinates.
        """
        if len(polygon_coords) < 3:
            return False

        try:
            # Shapely expects (x, y) = (lon, lat)
            shapely_polygon_pts = [(pt[1], pt[0]) for pt in polygon_coords]
            poly = Polygon(shapely_polygon_pts)
            point = Point(longitude, latitude)
            return poly.contains(point) or poly.touches(point)
        except Exception:
            return False

    @classmethod
    def assign_zone_for_point(
        cls,
        latitude: float,
        longitude: float,
        zones: List[ZoneResponse],
    ) -> Optional[str]:
        """Finds the first zone whose polygon boundary encloses the given coordinates."""
        for zone in zones:
            if cls.is_point_in_polygon(latitude, longitude, zone.boundary_coordinates):
                return zone.id
        return None

    @staticmethod
    def find_nearest_depot(
        latitude: float,
        longitude: float,
        depots: List[DepotResponse],
    ) -> Optional[Tuple[DepotResponse, float]]:
        """Returns the nearest depot to the coordinates and distance in meters."""
        if not depots:
            return None

        nearest = None
        min_dist = float("inf")

        for depot in depots:
            dist = haversine_distance(latitude, longitude, depot.latitude, depot.longitude)
            if dist < min_dist:
                min_dist = dist
                nearest = depot

        if nearest:
            return nearest, round(min_dist, 1)
        return None


spatial_service = SpatialService()
