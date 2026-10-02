import asyncio
from datetime import datetime, timezone
from typing import Dict, List, Optional
from app.schemas.plan import PlanResponse, RouteResponse, RouteStopResponse


class InMemoryPlanRepository:
    """In-memory repository managing Plans, Routes, and Route Stops."""

    def __init__(self):
        self._plans: Dict[str, PlanResponse] = {}
        self._stops: Dict[str, RouteStopResponse] = {}
        self._lock = asyncio.Lock()

    async def save_plan(self, plan: PlanResponse) -> PlanResponse:
        async with self._lock:
            self._plans[plan.id] = plan
            for r in plan.routes:
                for s in r.stops:
                    self._stops[s.id] = s
            return plan

    async def get_plan_by_id(self, plan_id: str) -> Optional[PlanResponse]:
        async with self._lock:
            plan = self._plans.get(plan_id)
            if not plan:
                return None
            # Refresh stops from state
            refreshed_routes = []
            for r in plan.routes:
                refreshed_stops = [self._stops.get(s.id, s) for s in r.stops]
                refreshed_routes.append(r.model_copy(update={"stops": refreshed_stops}))
            return plan.model_copy(update={"routes": refreshed_routes})

    async def list_plans(self) -> List[PlanResponse]:
        async with self._lock:
            return list(self._plans.values())

    async def update_plan_status(self, plan_id: str, status: str) -> Optional[PlanResponse]:
        async with self._lock:
            plan = self._plans.get(plan_id)
            if not plan:
                return None
            updated = plan.model_copy(update={"status": status})
            self._plans[plan_id] = updated
            return updated

    async def update_stop_outcome(
        self,
        stop_id: str,
        outcome: str,
        reason: Optional[str] = None,
        photo_url: Optional[str] = None,
    ) -> Optional[RouteStopResponse]:
        async with self._lock:
            stop = self._stops.get(stop_id)
            if not stop:
                return None

            now = datetime.now(timezone.utc)
            updated = stop.model_copy(
                update={
                    "outcome": outcome,
                    "outcome_reason": reason,
                    "proof_photo_url": photo_url,
                    "completed_at": now,
                }
            )
            self._stops[stop_id] = updated

            # Also update stop in the parent plan's route
            for plan_id, plan in self._plans.items():
                for route_idx, r in enumerate(plan.routes):
                    for stop_idx, s in enumerate(r.stops):
                        if s.id == stop_id:
                            new_stops = list(r.stops)
                            new_stops[stop_idx] = updated
                            new_routes = list(plan.routes)
                            new_routes[route_idx] = r.model_copy(update={"stops": new_stops})
                            self._plans[plan_id] = plan.model_copy(update={"routes": new_routes})
                            break

            return updated

    async def get_stop_by_id(self, stop_id: str) -> Optional[RouteStopResponse]:
        async with self._lock:
            return self._stops.get(stop_id)

    async def get_route_by_vehicle(self, vehicle_id: str) -> Optional[RouteResponse]:
        async with self._lock:
            for plan in self._plans.values():
                for r in plan.routes:
                    if r.vehicle_id == vehicle_id:
                        refreshed_stops = [self._stops.get(s.id, s) for s in r.stops]
                        return r.model_copy(update={"stops": refreshed_stops})
            return None


plan_repository = InMemoryPlanRepository()


def get_plan_repository() -> InMemoryPlanRepository:
    return plan_repository
