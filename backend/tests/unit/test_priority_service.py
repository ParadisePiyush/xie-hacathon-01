from datetime import datetime, timedelta, timezone
from app.schemas.config import PriorityConfig, PriorityWeights
from app.schemas.request import PriorityBand, Volume, WasteType
from app.services.priority_service import PriorityService


def test_weights_must_sum_to_one():
    weights = PriorityWeights(
        w_hazard=0.35,
        w_age=0.25,
        w_volume=0.15,
        w_repeat=0.10,
        w_sla_risk=0.15,
    )
    assert abs(sum([weights.w_hazard, weights.w_age, weights.w_volume, weights.w_repeat, weights.w_sla_risk]) - 1.0) < 0.001


def test_hazardous_scores_higher_than_recyclable():
    service = PriorityService()
    now = datetime.now(timezone.utc)

    score_haz, band_haz, _ = service.calculate_score(
        waste_type=WasteType.HAZARDOUS,
        volume=Volume.MEDIUM,
        created_at=now,
        now=now,
    )

    score_rec, band_rec, _ = service.calculate_score(
        waste_type=WasteType.RECYCLABLE,
        volume=Volume.MEDIUM,
        created_at=now,
        now=now,
    )

    assert score_haz > score_rec


def test_overflow_scores_higher_than_small():
    service = PriorityService()
    now = datetime.now(timezone.utc)

    score_over, _, _ = service.calculate_score(
        waste_type=WasteType.GENERAL,
        volume=Volume.OVERFLOW,
        created_at=now,
        now=now,
    )

    score_small, _, _ = service.calculate_score(
        waste_type=WasteType.GENERAL,
        volume=Volume.SMALL,
        created_at=now,
        now=now,
    )

    assert score_over > score_small


def test_priority_increases_with_age_and_sla_breach():
    service = PriorityService()
    now = datetime.now(timezone.utc)
    old_time = now - timedelta(hours=48)
    sla_time = now - timedelta(hours=1)  # SLA breached 1 hour ago

    score_fresh, _, _ = service.calculate_score(
        waste_type=WasteType.GENERAL,
        volume=Volume.MEDIUM,
        created_at=now,
        sla_due_at=now + timedelta(hours=24),
        now=now,
    )

    score_aged, _, _ = service.calculate_score(
        waste_type=WasteType.GENERAL,
        volume=Volume.MEDIUM,
        created_at=old_time,
        sla_due_at=sla_time,
        now=now,
    )

    assert score_aged > score_fresh


def test_critical_priority_band():
    service = PriorityService()
    now = datetime.now(timezone.utc)
    # Hazardous + Overflow + Breached SLA + Multiple repeats = Critical
    score, band, breakdown = service.calculate_score(
        waste_type=WasteType.HAZARDOUS,
        volume=Volume.OVERFLOW,
        created_at=now - timedelta(hours=48),
        sla_due_at=now - timedelta(hours=2),
        nearby_count=5,
        now=now,
    )

    assert score >= 75.0
    assert band == PriorityBand.CRITICAL
    assert breakdown["hazard_factor"] == 1.0
    assert breakdown["volume_factor"] == 1.0


def test_custom_priority_weights():
    custom_weights = PriorityWeights(
        w_hazard=0.60,
        w_age=0.10,
        w_volume=0.10,
        w_repeat=0.10,
        w_sla_risk=0.10,
    )
    config = PriorityConfig(weights=custom_weights)
    service = PriorityService(config=config)
    now = datetime.now(timezone.utc)

    score_haz, _, _ = service.calculate_score(
        waste_type=WasteType.HAZARDOUS,
        volume=Volume.SMALL,
        created_at=now,
        now=now,
    )

    # With 0.60 weight on hazard, hazardous alone contributes 60 points!
    assert score_haz >= 60.0
