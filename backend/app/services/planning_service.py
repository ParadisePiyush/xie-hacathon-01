from datetime import datetime, timezone
from typing import List, Optional
import uuid

from app.core.exceptions import BadRequestException, NotFoundException
from app.optimizer.distance_matrix import distance_matrix_service
from app.optimizer.vrp_solver import VRPOptimizer
from app.repositories.plan_repository import InMemoryPlanRepository, get_plan_repository
from app.repositories.resource_repository import InMemoryResourceRepository, get_resource_repository
from app.schemas.plan import (
    PlanGenerateRequest,
    PlanResponse,
    PlanStatus,
    RouteResponse,
    RouteStopCompleteRequest,
    RouteStopResponse,
)
from app.schemas.request import (
    PickupRequestResponse,
    PickupRequestTransition,
    RequestStatus,
)
from app.services.request_service import RequestService, get_request_service


class PlanningService:
    """Orchestrates vehicle routing optimization, route generation, and stop completion."""

    def __init__(
        self,
        plan_repo: Optional[InMemoryPlanRepository] = None,
        resource_repo: Optional[InMemoryResourceRepository] = None,
        request_srv: Optional[RequestService] = None,
    ):
        self.plan_repo = plan_repo or get_plan_repository()
        self.resource_repo = resource_repo or get_resource_repository()
        self.request_service = request_srv or get_request_service()

    async def generate_plan(self, payload: PlanGenerateRequest) -> PlanResponse:
        # 1. Resolve Depot
        depots = await self.resource_repo.list_depots()
        if not depots:
            raise BadRequestException(message="No depots available. Please create a depot first.")

        depot = None
        if payload.depot_id:
            depot = await self.resource_repo.get_depot(payload.depot_id)
            if not depot:
                raise NotFoundException(message=f"Depot '{payload.depot_id}' not found")
        else:
            depot = depots[0]

        depot_coord = (depot.latitude, depot.longitude)

        # 2. Resolve Vehicles
        all_vehicles = await self.resource_repo.list_vehicles()
        active_vehicles = [v for v in all_vehicles if v.is_active]

        if payload.vehicle_ids:
            vehicles = [v for v in active_vehicles if v.id in payload.vehicle_ids]
        else:
            vehicles = active_vehicles

        if not vehicles:
            raise BadRequestException(message="No active vehicles selected or available for routing.")

        # 3. Resolve Requests
        candidate_requests: List[PickupRequestResponse] = []
        if payload.request_ids:
            for req_id in payload.request_ids:
                try:
                    candidate_requests.append(await self.request_service.get_request(req_id))
                except NotFoundException:
                    pass
        else:
            # By default, take all verified or submitted requests
            items, _ = await self.request_service.list_requests(
                status=RequestStatus.VERIFIED,
                limit=100,
            )
            candidate_requests = items
            # If no verified requests exist, fallback to open submitted requests for testing convenience
            if not candidate_requests:
                items_sub, _ = await self.request_service.list_requests(
                    status=RequestStatus.SUBMITTED,
                    limit=100,
                )
                candidate_requests = items_sub

        if not candidate_requests:
            raise BadRequestException(message="No verified or open requests available to optimize.")

        # 4. Construct Coordinate List & Distance Matrix
        # Index 0 is depot, indices 1..N are candidate requests
        coords = [depot_coord] + [(r.latitude, r.longitude) for r in candidate_requests]
        dist_matrix, dur_matrix = await distance_matrix_service.compute_matrix(coords)

        # 5. Solve Capacitated VRP with OR-Tools
        plan_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        solved_plan = VRPOptimizer.solve(
            depot_coord=depot_coord,
            depot_name=depot.name,
            requests=candidate_requests,
            vehicles=vehicles,
            distance_matrix=dist_matrix,
            duration_matrix=dur_matrix,
            plan_start_time=now,
            time_limit_seconds=5,
        )

        # 6. Map into PlanResponse & update request statuses
        routes_response: List[RouteResponse] = []

        for solved_route in solved_plan.routes:
            route_id = str(uuid.uuid4())
            stops_response: List[RouteStopResponse] = []

            for s in solved_route.stops:
                stop_id = str(uuid.uuid4())
                stop_resp = RouteStopResponse(
                    id=stop_id,
                    route_id=route_id,
                    request_id=s.request.id,
                    sequence=s.sequence,
                    eta=s.eta,
                    outcome=None,
                    outcome_reason=None,
                    proof_photo_url=None,
                    completed_at=None,
                    request=s.request,
                )
                stops_response.append(stop_resp)

                # Transition request to PLANNED if it was submitted or verified
                if s.request.status in {RequestStatus.SUBMITTED, RequestStatus.VERIFIED}:
                    try:
                        # Auto-verify first if in submitted status
                        if s.request.status == RequestStatus.SUBMITTED:
                            await self.request_service.transition_status(
                                s.request.id,
                                PickupRequestTransition(to_status=RequestStatus.VERIFIED, note="Auto-verified for dispatch"),
                            )
                        await self.request_service.transition_status(
                            s.request.id,
                            PickupRequestTransition(to_status=RequestStatus.PLANNED, note=f"Assigned to route {solved_route.vehicle.plate}"),
                        )
                    except Exception:
                        pass

            routes_response.append(
                RouteResponse(
                    id=route_id,
                    plan_id=plan_id,
                    vehicle_id=solved_route.vehicle.id,
                    vehicle_plate=solved_route.vehicle.plate,
                    distance_m=solved_route.total_distance_m,
                    duration_s=solved_route.total_duration_s,
                    polyline=None,
                    stops=stops_response,
                )
            )

        plan_response = PlanResponse(
            id=plan_id,
            plan_date=payload.plan_date,
            status=PlanStatus.DRAFT.value,
            total_distance_m=solved_plan.total_distance_m,
            total_duration_s=solved_plan.total_duration_s,
            routes=routes_response,
            unserved_request_ids=[r.id for r in solved_plan.unserved_requests],
            created_at=now,
        )

        return await self.plan_repo.save_plan(plan_response)

    async def get_plan(self, plan_id: str) -> PlanResponse:
        plan = await self.plan_repo.get_plan_by_id(plan_id)
        if not plan:
            raise NotFoundException(message=f"Plan '{plan_id}' not found")
        return plan

    async def list_plans(self) -> List[PlanResponse]:
        return await self.plan_repo.list_plans()

    async def publish_plan(self, plan_id: str) -> PlanResponse:
        plan = await self.get_plan(plan_id)
        updated = await self.plan_repo.update_plan_status(plan_id, PlanStatus.PUBLISHED.value)
        if not updated:
            raise NotFoundException(message=f"Plan '{plan_id}' not found")
        return updated

    async def complete_route_stop(
        self,
        stop_id: str,
        payload: RouteStopCompleteRequest,
    ) -> RouteStopResponse:
        stop = await self.plan_repo.get_stop_by_id(stop_id)
        if not stop:
            raise NotFoundException(message=f"Route stop '{stop_id}' not found")

        updated_stop = await self.plan_repo.update_stop_outcome(
            stop_id=stop_id,
            outcome=payload.outcome,
            reason=payload.reason,
            photo_url=payload.proof_photo_url,
        )

        # Transition underlying pickup request
        if payload.outcome == "collected":
            try:
                # Transition through in_progress if still planned
                req = await self.request_service.get_request(stop.request_id)
                if req.status == RequestStatus.PLANNED:
                    await self.request_service.transition_status(
                        stop.request_id,
                        PickupRequestTransition(to_status=RequestStatus.IN_PROGRESS, actor_id="collector"),
                    )
                await self.request_service.transition_status(
                    stop.request_id,
                    PickupRequestTransition(
                        to_status=RequestStatus.COLLECTED,
                        actor_id="collector",
                        proof_photo_url=payload.proof_photo_url,
                        note="Stop collected with proof photo",
                    ),
                )
            except Exception:
                pass
        elif payload.outcome == "skipped":
            try:
                req = await self.request_service.get_request(stop.request_id)
                if req.status == RequestStatus.PLANNED:
                    await self.request_service.transition_status(
                        stop.request_id,
                        PickupRequestTransition(to_status=RequestStatus.IN_PROGRESS, actor_id="collector"),
                    )
                await self.request_service.transition_status(
                    stop.request_id,
                    PickupRequestTransition(
                        to_status=RequestStatus.SKIPPED,
                        actor_id="collector",
                        reason=payload.reason or "Skipped by collector",
                    ),
                )
            except Exception:
                pass

        return updated_stop  # type: ignore

    async def get_my_route(self, vehicle_id: Optional[str] = None) -> RouteResponse:
        if not vehicle_id:
            vehicles = await self.resource_repo.list_vehicles()
            if not vehicles:
                raise NotFoundException(message="No vehicles registered")
            vehicle_id = vehicles[0].id

        route = await self.plan_repo.get_route_by_vehicle(vehicle_id)
        if not route:
            raise NotFoundException(message=f"No active route assigned to vehicle '{vehicle_id}'")
        return route


planning_service = PlanningService()


def get_planning_service() -> PlanningService:
    return planning_service
