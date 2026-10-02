from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


# Depot Schemas
class DepotCreate(BaseModel):
    name: str = Field(..., max_length=150)
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    address: Optional[str] = Field(None, max_length=500)


class DepotUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=150)
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    address: Optional[str] = Field(None, max_length=500)


class DepotResponse(BaseModel):
    id: str
    name: str
    latitude: float
    longitude: float
    address: Optional[str] = None
    created_at: datetime


class NearestDepotResponse(BaseModel):
    depot: DepotResponse
    distance_meters: float


# Zone Schemas
class ZoneCreate(BaseModel):
    name: str = Field(..., max_length=150)
    color: Optional[str] = Field("#3B82F6", max_length=20)
    # List of [lat, lng] coordinates forming the polygon
    boundary_coordinates: List[List[float]] = Field(
        ...,
        min_length=3,
        description="List of [latitude, longitude] pairs defining the polygon boundary",
    )


class ZoneUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=150)
    color: Optional[str] = Field(None, max_length=20)
    boundary_coordinates: Optional[List[List[float]]] = None


class ZoneResponse(BaseModel):
    id: str
    name: str
    color: Optional[str] = None
    boundary_coordinates: List[List[float]]
    created_at: datetime


# Team Schemas
class TeamCreate(BaseModel):
    name: str = Field(..., max_length=150)
    depot_id: Optional[str] = Field(None, max_length=36)


class TeamUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=150)
    depot_id: Optional[str] = Field(None, max_length=36)


class TeamResponse(BaseModel):
    id: str
    name: str
    depot_id: Optional[str] = None
    created_at: datetime
    depot_name: Optional[str] = None


# Vehicle Schemas
class VehicleCreate(BaseModel):
    team_id: Optional[str] = Field(None, max_length=36)
    plate: str = Field(..., max_length=50)
    capacity_units: int = Field(20, ge=1, le=100)
    shift_start: str = Field("08:00", max_length=10)
    shift_end: str = Field("17:00", max_length=10)
    is_active: bool = True


class VehicleUpdate(BaseModel):
    team_id: Optional[str] = Field(None, max_length=36)
    plate: Optional[str] = Field(None, max_length=50)
    capacity_units: Optional[int] = Field(None, ge=1, le=100)
    shift_start: Optional[str] = Field(None, max_length=10)
    shift_end: Optional[str] = Field(None, max_length=10)
    is_active: Optional[bool] = None


class VehicleResponse(BaseModel):
    id: str
    team_id: Optional[str] = None
    plate: str
    capacity_units: int
    shift_start: str
    shift_end: str
    is_active: bool
    created_at: datetime
    team_name: Optional[str] = None
