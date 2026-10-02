from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class StatusHistoryItem(BaseModel):
    id: str = Field(..., description="Unique status history ID")
    request_id: str = Field(..., description="ID of associated pickup request")
    from_status: Optional[str] = Field(None, description="Previous status")
    to_status: str = Field(..., description="New status after transition")
    actor_id: Optional[str] = Field(None, description="Actor performing transition")
    note: Optional[str] = Field(None, description="Transition note or reason")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Timestamp of change")
