from datetime import date, datetime, timezone
from typing import Optional
import uuid
from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PlanModel(Base):
    __tablename__ = "plans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    plan_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    created_by: Mapped[Optional[str]] = mapped_column(String(100), default="dispatcher")
    status: Mapped[str] = mapped_column(String(50), default="draft")
    total_distance_m: Mapped[float] = mapped_column(Float, default=0.0)
    total_duration_s: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    routes = relationship("RouteModel", back_populates="plan", cascade="all, delete-orphan")


class RouteModel(Base):
    __tablename__ = "routes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    plan_id: Mapped[str] = mapped_column(String(36), ForeignKey("plans.id", ondelete="CASCADE"), nullable=False)
    vehicle_id: Mapped[str] = mapped_column(String(36), ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False)
    distance_m: Mapped[float] = mapped_column(Float, default=0.0)
    duration_s: Mapped[float] = mapped_column(Float, default=0.0)
    polyline: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    plan = relationship("PlanModel", back_populates="routes")
    stops = relationship("RouteStopModel", back_populates="route", cascade="all, delete-orphan", order_by="RouteStopModel.sequence")


class RouteStopModel(Base):
    __tablename__ = "route_stops"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    route_id: Mapped[str] = mapped_column(String(36), ForeignKey("routes.id", ondelete="CASCADE"), nullable=False)
    request_id: Mapped[str] = mapped_column(String(36), ForeignKey("pickup_requests.id", ondelete="CASCADE"), nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    eta: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    outcome: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # collected, skipped
    outcome_reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    proof_photo_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    route = relationship("RouteModel", back_populates="stops")
