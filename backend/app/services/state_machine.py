from typing import Dict, List, Set
from app.core.exceptions import InvalidStateTransitionException
from app.schemas.request import RequestStatus

# State Machine Transition Rules
ALLOWED_TRANSITIONS: Dict[RequestStatus, Set[RequestStatus]] = {
    RequestStatus.SUBMITTED: {
        RequestStatus.VERIFIED,
        RequestStatus.REJECTED,
        RequestStatus.CANCELLED,
    },
    RequestStatus.VERIFIED: {
        RequestStatus.PLANNED,
        RequestStatus.CANCELLED,
        RequestStatus.REJECTED,
    },
    RequestStatus.PLANNED: {
        RequestStatus.IN_PROGRESS,
        RequestStatus.VERIFIED,  # e.g., removed from draft plan
        RequestStatus.CANCELLED,
    },
    RequestStatus.IN_PROGRESS: {
        RequestStatus.COLLECTED,
        RequestStatus.SKIPPED,
        RequestStatus.PLANNED,   # interrupted / postponed
    },
    RequestStatus.SKIPPED: {
        RequestStatus.VERIFIED,  # re-queued for next dispatch
        RequestStatus.PLANNED,
        RequestStatus.CANCELLED,
    },
    RequestStatus.COLLECTED: set(),  # Terminal
    RequestStatus.REJECTED: set(),   # Terminal
    RequestStatus.CANCELLED: set(),  # Terminal
}


class RequestStateMachine:
    """Validates and governs lifecycle state transitions for pickup requests."""

    @staticmethod
    def get_allowed_transitions(current_status: RequestStatus) -> List[RequestStatus]:
        return sorted(list(ALLOWED_TRANSITIONS.get(current_status, set())), key=lambda x: x.value)

    @classmethod
    def can_transition(cls, from_status: RequestStatus, to_status: RequestStatus) -> bool:
        allowed = ALLOWED_TRANSITIONS.get(from_status, set())
        return to_status in allowed

    @classmethod
    def validate_transition(
        cls,
        from_status: RequestStatus,
        to_status: RequestStatus,
        reason: str | None = None,
    ) -> None:
        if from_status == to_status:
            raise InvalidStateTransitionException(
                message=f"Request is already in '{from_status.value}' status",
                details={
                    "current_status": from_status.value,
                    "target_status": to_status.value,
                },
            )

        allowed = ALLOWED_TRANSITIONS.get(from_status, set())
        if to_status not in allowed:
            allowed_names = [s.value for s in allowed]
            raise InvalidStateTransitionException(
                message=f"Cannot transition request from '{from_status.value}' to '{to_status.value}'. "
                        f"Allowed transitions: {allowed_names or 'None (terminal state)'}",
                details={
                    "current_status": from_status.value,
                    "target_status": to_status.value,
                    "allowed_transitions": allowed_names,
                },
            )

        # Domain checks for required reasons
        if to_status in {RequestStatus.SKIPPED, RequestStatus.REJECTED} and not reason:
            raise InvalidStateTransitionException(
                message=f"A reason must be provided when transitioning to '{to_status.value}'",
                details={
                    "current_status": from_status.value,
                    "target_status": to_status.value,
                    "missing_field": "reason",
                },
            )
