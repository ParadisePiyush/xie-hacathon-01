from datetime import datetime, timezone
from typing import List, Optional
import uuid
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PickupRequestModel(Base):
    __tablename__ = "pickup_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    reporter_id: Mapped[Optional[str]] = mapped_column(String(100), default="anonymous", nullable=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False, index=True)
    longitude: Mapped[float] = mapped_column(Float, nullable=False, index=True)
    address: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    waste_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    volume: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    photo_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="submitted", index=True, nullable=False)
    priority_score: Mapped[float] = mapped_column(Float, default=0.0, index=True, nullable=False)
    priority_band: Mapped[str] = mapped_column(String(20), default="low", index=True, nullable=False)
    zone_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("zones.id", ondelete="SET NULL"), nullable=True)
    duplicate_of: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("pickup_requests.id", ondelete="SET NULL"), nullable=True)
    repeat_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sla_due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    zone = relationship("ZoneModel", back_populates="requests", lazy="joined")
    history = relationship("RequestStatusHistoryModel", back_populates="request", cascade="all, delete-orphan", order_by="RequestStatusHistoryModel.created_at")


class RequestStatusHistoryModel(Base):
    __tablename__ = "request_status_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    request_id: Mapped[str] = mapped_column(String(36), ForeignKey("pickup_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    from_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    to_status: Mapped[str] = mapped_column(String(50), nullable=False)
    actor_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    request = relationship("PickupRequestModel", back_populates="history")
