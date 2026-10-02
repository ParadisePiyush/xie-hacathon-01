from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field

from app.schemas.history import StatusHistoryItem


class WasteType(str, Enum):
    GENERAL = "general"
    RECYCLABLE = "recyclable"
    HAZARDOUS = "hazardous"
    MEDICAL = "medical"
    E_WASTE = "e_waste"
    ORGANIC = "organic"
    CONSTRUCTION = "construction"


class Volume(str, Enum):
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"
    OVERFLOW = "overflow"


class RequestStatus(str, Enum):
    SUBMITTED = "submitted"
    VERIFIED = "verified"
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COLLECTED = "collected"
    SKIPPED = "skipped"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class PriorityBand(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class PickupRequestCreate(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees")
    address: Optional[str] = Field(None, max_length=500, description="Textual or geocoded address")
    waste_type: WasteType = Field(..., description="Category of waste")
    volume: Volume = Field(..., description="Estimated volume/bulk")
    description: Optional[str] = Field(None, max_length=1000, description="Detailed notes on location or waste")
    photo_url: Optional[str] = Field(None, max_length=1000, description="Uploaded photo URL")
    reporter_id: Optional[str] = Field("anonymous", max_length=100, description="Reporter user/citizen ID")
    zone_id: Optional[str] = Field(None, max_length=100, description="Zone identifier")


class PickupRequestUpdate(BaseModel):
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    address: Optional[str] = Field(None, max_length=500)
    waste_type: Optional[WasteType] = None
    volume: Optional[Volume] = None
    description: Optional[str] = Field(None, max_length=1000)
    photo_url: Optional[str] = Field(None, max_length=1000)
    zone_id: Optional[str] = None


class PickupRequestTransition(BaseModel):
    to_status: RequestStatus = Field(..., description="Target status for transition")
    note: Optional[str] = Field(None, max_length=500, description="Optional note or comment")
    reason: Optional[str] = Field(None, max_length=500, description="Required reason when skipping or rejecting")
    actor_id: Optional[str] = Field("dispatcher", max_length=100, description="User ID performing transition")
    proof_photo_url: Optional[str] = Field(None, max_length=1000, description="Proof photo URL for completion")


class PickupRequestResponse(BaseModel):
    id: str
    reporter_id: Optional[str] = None
    latitude: float
    longitude: float
    address: Optional[str] = None
    waste_type: WasteType
    volume: Volume
    description: Optional[str] = None
    photo_url: Optional[str] = None
    status: RequestStatus
    priority_score: float = Field(..., description="Priority score from 0.0 to 100.0")
    priority_band: PriorityBand
    zone_id: Optional[str] = None
    duplicate_of: Optional[str] = None
    repeat_count: int = 0
    sla_due_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    history: List[StatusHistoryItem] = []


class PickupRequestDetailResponse(PickupRequestResponse):
    """Includes complete status history."""
    pass
