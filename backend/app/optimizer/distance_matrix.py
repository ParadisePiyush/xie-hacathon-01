import math
from typing import List, Tuple
import httpx

from app.core.config import settings
from app.core.logging import logger
from app.services.spatial_service import haversine_distance


class DistanceMatrixService:
    """Computes driving distance (meters) and travel duration (seconds) matrices.

    Uses OSRM table API with automatic fallback to Haversine with a 1.3 road detour
    factor at an average urban speed of 30 km/h (8.33 m/s).
    """

    def __init__(self, osrm_url: str | None = None):
        self.osrm_url = osrm_url or settings.OSRM_URL

    async def compute_matrix(
        self,
        coordinates: List[Tuple[float, float]],  # List of (latitude, longitude)
    ) -> Tuple[List[List[float]], List[List[float]]]:
        """Returns (distance_matrix_meters, duration_matrix_seconds)."""
        n = len(coordinates)
        if n == 0:
            return [], []
        if n == 1:
            return [[0.0]], [[0.0]]

        # Try OSRM table API if available and responsive
        try:
            return await self._fetch_osrm_matrix(coordinates)
        except Exception as e:
            logger.info("OSRM matrix lookup failed or offline (%s). Using Haversine road detour fallback.", e)
            return self._compute_haversine_fallback_matrix(coordinates)

    async def _fetch_osrm_matrix(
        self,
        coordinates: List[Tuple[float, float]],
    ) -> Tuple[List[List[float]], List[List[float]]]:
        # OSRM expects coordinates in lng,lat format separated by semicolon
        coord_str = ";".join([f"{lon},{lat}" for lat, lon in coordinates])
        url = f"{self.osrm_url}/table/v1/driving/{coord_str}?annotations=distance,duration"

        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("code") == "Ok":
                    distances = data.get("distances", [])
                    durations = data.get("durations", [])
                    return distances, durations

        raise RuntimeError("OSRM returned non-OK response")

    def _compute_haversine_fallback_matrix(
        self,
        coordinates: List[Tuple[float, float]],
    ) -> Tuple[List[List[float]], List[List[float]]]:
        """Calculates distance matrix using Haversine * 1.3 detour factor at 30 km/h."""
        n = len(coordinates)
        speed_mps = 30000.0 / 3600.0  # 30 km/h in meters/sec (~8.33 m/s)
        detour_factor = 1.3

        distance_matrix: List[List[float]] = [[0.0] * n for _ in range(n)]
        duration_matrix: List[List[float]] = [[0.0] * n for _ in range(n)]

        for i in range(n):
            lat1, lon1 = coordinates[i]
            for j in range(i, n):
                if i == j:
                    distance_matrix[i][j] = 0.0
                    duration_matrix[i][j] = 0.0
                else:
                    lat2, lon2 = coordinates[j]
                    direct_dist = haversine_distance(lat1, lon1, lat2, lon2)
                    road_dist = direct_dist * detour_factor
                    travel_time = road_dist / speed_mps

                    distance_matrix[i][j] = round(road_dist, 1)
                    distance_matrix[j][i] = round(road_dist, 1)

                    duration_matrix[i][j] = round(travel_time, 1)
                    duration_matrix[j][i] = round(travel_time, 1)

        return distance_matrix, duration_matrix


distance_matrix_service = DistanceMatrixService()
