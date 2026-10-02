from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple
from ortools.constraint_solver import pywrapcp, routing_enums_pb2

from app.core.logging import logger
from app.schemas.request import PickupRequestResponse, Volume
from app.schemas.resource import VehicleResponse

VOLUME_UNITS: Dict[Volume, int] = {
    Volume.SMALL: 1,
    Volume.MEDIUM: 2,
    Volume.LARGE: 4,
    Volume.OVERFLOW: 6,
}

SERVICE_TIME_SECONDS = 600  # 10 minutes service time per stop


@dataclass
class SolvedStop:
    request: PickupRequestResponse
    sequence: int
    eta: datetime
    distance_from_prev_m: float
    duration_from_prev_s: float
    cumulative_distance_m: float


@dataclass
class SolvedRoute:
    vehicle: VehicleResponse
    stops: List[SolvedStop]
    total_distance_m: float
    total_duration_s: float
    total_volume_units: int


@dataclass
class SolvedPlan:
    routes: List[SolvedRoute]
    unserved_requests: List[PickupRequestResponse]
    total_distance_m: float
    total_duration_s: float


class VRPOptimizer:
    """Capacitated Vehicle Routing Problem with Time Windows and Priority-Weighted Drop Penalties."""

    @classmethod
    def solve(
        cls,
        depot_coord: Tuple[float, float],
        depot_name: str,
        requests: List[PickupRequestResponse],
        vehicles: List[VehicleResponse],
        distance_matrix: List[List[float]],
        duration_matrix: List[List[float]],
        plan_start_time: datetime,
        time_limit_seconds: int = 5,
    ) -> SolvedPlan:
        if not requests or not vehicles:
            return SolvedPlan(
                routes=[],
                unserved_requests=requests,
                total_distance_m=0.0,
                total_duration_s=0.0,
            )

        num_vehicles = len(vehicles)
        num_locations = len(distance_matrix)  # 0 is depot, 1..n are requests
        depot_index = 0

        # Demands per node
        demands = [0]  # depot demand = 0
        for req in requests:
            demands.append(VOLUME_UNITS.get(req.volume, 2))

        vehicle_capacities = [v.capacity_units for v in vehicles]

        # 1. Routing Index Manager & Model
        manager = pywrapcp.RoutingIndexManager(num_locations, num_vehicles, depot_index)
        routing = pywrapcp.RoutingModel(manager)

        # 2. Distance Cost Callback (Arc Cost)
        def distance_callback(from_index: int, to_index: int) -> int:
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return int(distance_matrix[from_node][to_node])

        transit_callback_index = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

        # 3. Capacity Dimension
        def demand_callback(from_index: int) -> int:
            from_node = manager.IndexToNode(from_index)
            return demands[from_node]

        demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
        routing.AddDimensionWithVehicleCapacity(
            demand_callback_index,
            0,  # null capacity slack
            vehicle_capacities,  # vehicle maximum capacities
            True,  # start cumul to zero
            "Capacity",
        )

        # 4. Time Dimension
        def time_callback(from_index: int, to_index: int) -> int:
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            travel_sec = duration_matrix[from_node][to_node]
            service_sec = 0 if from_node == depot_index else SERVICE_TIME_SECONDS
            return int(travel_sec + service_sec)

        time_callback_index = routing.RegisterTransitCallback(time_callback)
        shift_duration_seconds = 9 * 3600  # 9-hour maximum shift window
        routing.AddDimension(
            time_callback_index,
            3600,  # allow 1 hour waiting slack
            shift_duration_seconds,
            True,  # start cumul to zero
            "Time",
        )

        # 5. Priority Disjunctions (Optional Stops with Priority-Weighted Penalties)
        # Drop penalty = score * K. High priority requests incur steep drop penalties,
        # forcing the solver to visit Critical & High requests first.
        penalty_multiplier = 2000
        for req_idx, req in enumerate(requests, start=1):
            penalty = int(max(10.0, req.priority_score) * penalty_multiplier)
            routing.AddDisjunction([manager.NodeToIndex(req_idx)], penalty)

        # 6. Search Parameters
        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = (
            routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        )
        search_parameters.local_search_metaheuristic = (
            routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        )
        search_parameters.time_limit.seconds = time_limit_seconds

        # 7. Solve
        solution = routing.SolveWithParameters(search_parameters)

        if not solution:
            logger.warning("VRP Solver found no feasible solution. Returning all requests unserved.")
            return SolvedPlan(
                routes=[],
                unserved_requests=requests,
                total_distance_m=0.0,
                total_duration_s=0.0,
            )

        # 8. Extract Solution
        routes: List[SolvedRoute] = []
        served_request_indices = set()
        plan_total_dist = 0.0
        plan_total_duration = 0.0

        for vehicle_id in range(num_vehicles):
            index = routing.Start(vehicle_id)
            current_time = plan_start_time
            veh = vehicles[vehicle_id]
            route_stops: List[SolvedStop] = []
            route_dist = 0.0
            route_duration = 0.0
            route_vol = 0
            seq = 1

            while not routing.IsEnd(index):
                node_index = manager.IndexToNode(index)
                next_index = solution.Value(routing.NextVar(index))
                next_node = manager.IndexToNode(next_index)

                if next_node != depot_index:
                    req = requests[next_node - 1]
                    served_request_indices.add(next_node - 1)

                    leg_dist = distance_matrix[node_index][next_node]
                    leg_duration = duration_matrix[node_index][next_node]
                    route_dist += leg_dist
                    route_duration += leg_duration + SERVICE_TIME_SECONDS
                    route_vol += demands[next_node]

                    current_time += timedelta(seconds=leg_duration)
                    route_stops.append(
                        SolvedStop(
                            request=req,
                            sequence=seq,
                            eta=current_time,
                            distance_from_prev_m=round(leg_dist, 1),
                            duration_from_prev_s=round(leg_duration, 1),
                            cumulative_distance_m=round(route_dist, 1),
                        )
                    )
                    # Add service time before departing to next stop
                    current_time += timedelta(seconds=SERVICE_TIME_SECONDS)
                    seq += 1

                index = next_index

            # Final return to depot
            if route_stops:
                last_stop_node = manager.IndexToNode(routing.End(vehicle_id) - 1)
                return_dist = distance_matrix[last_stop_node][depot_index]
                return_dur = duration_matrix[last_stop_node][depot_index]
                route_dist += return_dist
                route_duration += return_dur

            routes.append(
                SolvedRoute(
                    vehicle=veh,
                    stops=route_stops,
                    total_distance_m=round(route_dist, 1),
                    total_duration_s=round(route_duration, 1),
                    total_volume_units=route_vol,
                )
            )
            plan_total_dist += route_dist
            plan_total_duration = max(plan_total_duration, route_duration)

        unserved = [req for i, req in enumerate(requests) if i not in served_request_indices]

        return SolvedPlan(
            routes=routes,
            unserved_requests=unserved,
            total_distance_m=round(plan_total_dist, 1),
            total_duration_s=round(plan_total_duration, 1),
        )
