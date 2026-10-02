from datetime import datetime, timezone
from typing import Optional, Tuple
from app.schemas.config import PriorityConfig
from app.schemas.request import PriorityBand, Volume, WasteType


class PriorityService:
    """Computes dynamic priority scores and priority bands for pickup requests."""

    def __init__(self, config: Optional[PriorityConfig] = None):
        self.config = config or PriorityConfig()

    def update_config(self, new_config: PriorityConfig) -> None:
        self.config = new_config

    def calculate_score(
        self,
        waste_type: WasteType,
        volume: Volume,
        created_at: datetime,
        sla_due_at: Optional[datetime] = None,
        nearby_count: int = 0,
        now: Optional[datetime] = None,
    ) -> Tuple[float, PriorityBand, dict]:
        """Calculates normalized factors, composite priority score (0-100), and band.

        Returns: (score, band, breakdown_dict)
        """
        current_time = now or datetime.now(timezone.utc)
        if current_time.tzinfo is None:
            current_time = current_time.replace(tzinfo=timezone.utc)
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)

        # 1. Hazard factor (0.0 to 1.0)
        hazard_val = self.config.hazard_scores.get(waste_type.value, 0.3)

        # 2. Age factor (0.0 to 1.0)
        elapsed_seconds = max(0.0, (current_time - created_at).total_seconds())
        elapsed_hours = elapsed_seconds / 3600.0
        max_sla = self.config.max_sla_hours
        age_factor = min(1.0, max(0.0, elapsed_hours / max_sla))

        # 3. Volume factor (0.0 to 1.0)
        volume_val = self.config.volume_scores.get(volume.value, 0.25)

        # 4. Repeat factor (0.0 to 1.0)
        saturation = max(1, self.config.repeat_saturation_count)
        repeat_factor = min(1.0, max(0.0, nearby_count / float(saturation)))

        # 5. SLA Risk factor (0.0 to 1.0, higher means closer to or past deadline)
        if sla_due_at is None:
            # Fallback SLA window = max_sla_hours
            total_sla_seconds = max_sla * 3600.0
            sla_risk = age_factor  # Proportional to elapsed ratio
        else:
            if sla_due_at.tzinfo is None:
                sla_due_at = sla_due_at.replace(tzinfo=timezone.utc)

            total_window = (sla_due_at - created_at).total_seconds()
            if total_window <= 0:
                sla_risk = 1.0
            else:
                remaining_seconds = (sla_due_at - current_time).total_seconds()
                if remaining_seconds <= 0:
                    sla_risk = 1.0
                else:
                    elapsed_ratio = 1.0 - (remaining_seconds / total_window)
                    sla_risk = min(1.0, max(0.0, elapsed_ratio))

        # Weighted calculation
        weights = self.config.weights
        composite_ratio = (
            weights.w_hazard * hazard_val
            + weights.w_age * age_factor
            + weights.w_volume * volume_val
            + weights.w_repeat * repeat_factor
            + weights.w_sla_risk * sla_risk
        )

        raw_score = round(composite_ratio * 100.0, 2)
        score = max(0.0, min(100.0, raw_score))

        # Priority bands (PRD §6):
        # Critical >= 75, High 50–74, Medium 25–49, Low < 25
        if score >= 75.0:
            band = PriorityBand.CRITICAL
        elif score >= 50.0:
            band = PriorityBand.HIGH
        elif score >= 25.0:
            band = PriorityBand.MEDIUM
        else:
            band = PriorityBand.LOW

        breakdown = {
            "hazard_factor": round(hazard_val, 4),
            "age_factor": round(age_factor, 4),
            "volume_factor": round(volume_val, 4),
            "repeat_factor": round(repeat_factor, 4),
            "sla_risk_factor": round(sla_risk, 4),
            "score": score,
            "band": band.value,
        }

        return score, band, breakdown


priority_service = PriorityService()
