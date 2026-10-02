from typing import Dict
from pydantic import BaseModel, Field, model_validator


class PriorityWeights(BaseModel):
    w_hazard: float = Field(0.35, ge=0.0, le=1.0, description="Weight for waste type hazard factor")
    w_age: float = Field(0.25, ge=0.0, le=1.0, description="Weight for age / waiting time factor")
    w_volume: float = Field(0.15, ge=0.0, le=1.0, description="Weight for volume factor")
    w_repeat: float = Field(0.10, ge=0.0, le=1.0, description="Weight for nearby repeat reports factor")
    w_sla_risk: float = Field(0.15, ge=0.0, le=1.0, description="Weight for SLA risk factor")

    @model_validator(mode="after")
    def validate_weights_sum(self) -> "PriorityWeights":
        total = self.w_hazard + self.w_age + self.w_volume + self.w_repeat + self.w_sla_risk
        # Allow tiny floating point imprecision
        if abs(total - 1.0) > 0.01:
            raise ValueError(f"Priority weights must sum to 1.0 (current sum: {round(total, 4)})")
        return self


class PriorityConfig(BaseModel):
    weights: PriorityWeights = Field(default_factory=PriorityWeights)
    max_sla_hours: float = Field(48.0, gt=0, description="Maximum SLA window in hours for normalization")
    repeat_radius_meters: float = Field(50.0, gt=0, description="Radius to count nearby duplicate reports")
    repeat_saturation_count: int = Field(5, gt=0, description="Nearby reports count that saturates repeat factor to 1.0")

    hazard_scores: Dict[str, float] = Field(
        default_factory=lambda: {
            "hazardous": 1.0,
            "medical": 0.9,
            "e_waste": 0.6,
            "construction": 0.4,
            "general": 0.3,
            "organic": 0.3,
            "recyclable": 0.2,
        },
        description="Normalized hazard score per waste type (0.0 to 1.0)",
    )

    volume_scores: Dict[str, float] = Field(
        default_factory=lambda: {
            "small": 0.25,
            "medium": 0.50,
            "large": 0.75,
            "overflow": 1.00,
        },
        description="Normalized score per volume category (0.0 to 1.0)",
    )


class PriorityConfigUpdate(BaseModel):
    weights: PriorityWeights
    max_sla_hours: float = 48.0
    repeat_radius_meters: float = 50.0
    repeat_saturation_count: int = 5
