import pytest
from app.core.exceptions import InvalidStateTransitionException
from app.schemas.request import RequestStatus
from app.services.state_machine import RequestStateMachine


def test_allowed_submitted_transitions():
    allowed = RequestStateMachine.get_allowed_transitions(RequestStatus.SUBMITTED)
    assert RequestStatus.VERIFIED in allowed
    assert RequestStatus.REJECTED in allowed
    assert RequestStatus.CANCELLED in allowed
    assert RequestStatus.COLLECTED not in allowed


def test_valid_lifecycle_progression():
    # SUBMITTED -> VERIFIED
    RequestStateMachine.validate_transition(RequestStatus.SUBMITTED, RequestStatus.VERIFIED)

    # VERIFIED -> PLANNED
    RequestStateMachine.validate_transition(RequestStatus.VERIFIED, RequestStatus.PLANNED)

    # PLANNED -> IN_PROGRESS
    RequestStateMachine.validate_transition(RequestStatus.PLANNED, RequestStatus.IN_PROGRESS)

    # IN_PROGRESS -> COLLECTED
    RequestStateMachine.validate_transition(RequestStatus.IN_PROGRESS, RequestStatus.COLLECTED)


def test_skip_requires_reason():
    with pytest.raises(InvalidStateTransitionException) as exc_info:
        RequestStateMachine.validate_transition(
            RequestStatus.IN_PROGRESS, RequestStatus.SKIPPED, reason=None
        )
    assert "reason must be provided" in exc_info.value.message

    # Providing reason should succeed
    RequestStateMachine.validate_transition(
        RequestStatus.IN_PROGRESS, RequestStatus.SKIPPED, reason="Gate was locked"
    )


def test_reject_requires_reason():
    with pytest.raises(InvalidStateTransitionException) as exc_info:
        RequestStateMachine.validate_transition(
            RequestStatus.SUBMITTED, RequestStatus.REJECTED, reason=None
        )
    assert "reason must be provided" in exc_info.value.message

    RequestStateMachine.validate_transition(
        RequestStatus.SUBMITTED, RequestStatus.REJECTED, reason="Spam report"
    )


def test_terminal_states_cannot_transition():
    terminal_states = [RequestStatus.COLLECTED, RequestStatus.REJECTED, RequestStatus.CANCELLED]
    for state in terminal_states:
        allowed = RequestStateMachine.get_allowed_transitions(state)
        assert len(allowed) == 0

        with pytest.raises(InvalidStateTransitionException):
            RequestStateMachine.validate_transition(state, RequestStatus.VERIFIED)


def test_same_state_transition_fails():
    with pytest.raises(InvalidStateTransitionException) as exc_info:
        RequestStateMachine.validate_transition(
            RequestStatus.SUBMITTED, RequestStatus.SUBMITTED
        )
    assert "already in" in exc_info.value.message
