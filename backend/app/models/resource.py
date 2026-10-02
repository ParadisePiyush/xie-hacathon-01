from datetime import datetime, timezone
from typing import List, Optional
import uuid
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class DepotModel(Base):
    __tablename__ = "depots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    address: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    teams = relationship("TeamModel", back_populates="depot", cascade="all, delete-orphan")


class ZoneModel(Base):
    __tablename__ = "zones"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    color: Mapped[Optional[str]] = mapped_column(String(20), default="#3B82F6")
    # Coordinates stored as JSON list of [lat, lng] or GeoJSON polygon geometry
    boundary_coordinates: Mapped[list] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    requests = relationship("PickupRequestModel", back_populates="zone")


class TeamModel(Base):
    __tablename__ = "teams"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    depot_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("depots.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    depot = relationship("DepotModel", back_populates="teams", lazy="joined")
    vehicles = relationship("VehicleModel", back_populates="team", cascade="all, delete-orphan")
    members = relationship("UserModel", back_populates="team")


class VehicleModel(Base):
    __tablename__ = "vehicles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    team_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True)
    plate: Mapped[str] = mapped_column(String(50), nullable=False)
    capacity_units: Mapped[int] = mapped_column(Integer, default=20, nullable=False)
    shift_start: Mapped[str] = mapped_column(String(10), default="08:00")
    shift_end: Mapped[str] = mapped_column(String(10), default="17:00")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    team = relationship("TeamModel", back_populates="vehicles", lazy="joined")
