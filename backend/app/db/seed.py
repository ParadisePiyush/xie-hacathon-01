import asyncio
from datetime import datetime, timedelta, timezone

from app.core.logging import logger
from app.repositories.in_memory_request_repository import in_memory_repository
from app.repositories.resource_repository import resource_repository
from app.schemas.history import StatusHistoryItem
from app.schemas.request import (
    PickupRequestResponse,
    PriorityBand,
    RequestStatus,
    Volume,
    WasteType,
)
from app.schemas.resource import DepotCreate, TeamCreate, VehicleCreate, ZoneCreate
from app.services.priority_service import priority_service


async def seed_data():
    logger.info("Starting seed process for Smart Waste Collection Optimizer...")

    # 1. Seed Depots
    depot_central = await resource_repository.create_depot(
        DepotCreate(
            name="Central Operations Depot",
            latitude=19.9975,
            longitude=73.7898,
            address="Plot 12, Industrial Area, Sector 4",
        )
    )
    depot_north = await resource_repository.create_depot(
        DepotCreate(
            name="Northside Transfer Station",
            latitude=20.0250,
            longitude=73.8150,
            address="Highway 84, North Gate",
        )
    )
    logger.info("Seeded 2 Depots: %s, %s", depot_central.name, depot_north.name)

    # 2. Seed Zones with Polygon Coordinates [ [lat, lng], ... ]
    # Zone 1: Downtown Commercial
    zone_downtown = await resource_repository.create_zone(
        ZoneCreate(
            name="Zone 1 - Downtown Commercial",
            color="#EF4444",
            boundary_coordinates=[
                [19.9900, 73.7800],
                [20.0050, 73.7800],
                [20.0050, 73.8000],
                [19.9900, 73.8000],
                [19.9900, 73.7800],
            ],
        )
    )

    # Zone 2: North Residential
    zone_north = await resource_repository.create_zone(
        ZoneCreate(
            name="Zone 2 - North Residential",
            color="#3B82F6",
            boundary_coordinates=[
                [20.0100, 73.8050],
                [20.0350, 73.8050],
                [20.0350, 73.8300],
                [20.0100, 73.8300],
                [20.0100, 73.8050],
            ],
        )
    )

    # Zone 3: East Industrial
    zone_east = await resource_repository.create_zone(
        ZoneCreate(
            name="Zone 3 - East Industrial",
            color="#F59E0B",
            boundary_coordinates=[
                [19.9800, 73.8050],
                [20.0050, 73.8050],
                [20.0050, 73.8350],
                [19.9800, 73.8350],
                [19.9800, 73.8050],
            ],
        )
    )
    logger.info("Seeded 3 Zones: %s, %s, %s", zone_downtown.name, zone_north.name, zone_east.name)

    # 3. Seed Teams
    team_alpha = await resource_repository.create_team(
        TeamCreate(name="Alpha Crew (Hazardous & Heavy)", depot_id=depot_central.id)
    )
    team_beta = await resource_repository.create_team(
        TeamCreate(name="Beta Rapid Response", depot_id=depot_central.id)
    )
    team_gamma = await resource_repository.create_team(
        TeamCreate(name="Gamma North Squad", depot_id=depot_north.id)
    )
    logger.info("Seeded 3 Teams: %s, %s, %s", team_alpha.name, team_beta.name, team_gamma.name)

    # 4. Seed Vehicles
    await resource_repository.create_vehicle(
        VehicleCreate(
            team_id=team_alpha.id,
            plate="MH-15-AB-1001",
            capacity_units=30,
            shift_start="07:30",
            shift_end="16:00",
        )
    )
    await resource_repository.create_vehicle(
        VehicleCreate(
            team_id=team_beta.id,
            plate="MH-15-CD-2002",
            capacity_units=20,
            shift_start="08:00",
            shift_end="17:00",
        )
    )
    await resource_repository.create_vehicle(
        VehicleCreate(
            team_id=team_gamma.id,
            plate="MH-15-EF-3003",
            capacity_units=25,
            shift_start="08:30",
            shift_end="17:30",
        )
    )
    logger.info("Seeded 3 Vehicles")

    # 5. Seed Pickup Requests
    now = datetime.now(timezone.utc)
    sample_requests = [
        {
            "id": "req-seed-001",
            "lat": 19.9982,
            "lng": 73.7912,
            "type": WasteType.HAZARDOUS,
            "vol": Volume.OVERFLOW,
            "desc": "Hospital spill containers near back gate",
            "addr": "Old City Hospital Back Alley",
            "zone": zone_downtown.id,
            "status": RequestStatus.VERIFIED,
            "age_hours": 12,
        },
        {
            "id": "req-seed-002",
            "lat": 19.9940,
            "lng": 73.7850,
            "type": WasteType.E_WASTE,
            "vol": Volume.MEDIUM,
            "desc": "Discarded electronics and lithium batteries",
            "addr": "Tech Park Gate 3",
            "zone": zone_downtown.id,
            "status": RequestStatus.SUBMITTED,
            "age_hours": 6,
        },
        {
            "id": "req-seed-003",
            "lat": 20.0210,
            "lng": 73.8180,
            "type": WasteType.MEDICAL,
            "vol": Volume.LARGE,
            "desc": "Medical clinic sharps container overflowing",
            "addr": "Sunrise Clinic Lane",
            "zone": zone_north.id,
            "status": RequestStatus.VERIFIED,
            "age_hours": 18,
        },
        {
            "id": "req-seed-004",
            "lat": 20.0150,
            "lng": 73.8210,
            "type": WasteType.GENERAL,
            "vol": Volume.MEDIUM,
            "desc": "Community bin full after weekend market",
            "addr": "Market Square Block 4",
            "zone": zone_north.id,
            "status": RequestStatus.SUBMITTED,
            "age_hours": 4,
        },
        {
            "id": "req-seed-005",
            "lat": 19.9920,
            "lng": 73.8150,
            "type": WasteType.CONSTRUCTION,
            "vol": Volume.OVERFLOW,
            "desc": "Demolition debris blocking sidewalk",
            "addr": "East bypass road corner",
            "zone": zone_east.id,
            "status": RequestStatus.SUBMITTED,
            "age_hours": 24,
        },
    ]

    for req_data in sample_requests:
        created_time = now - timedelta(hours=req_data["age_hours"])
        sla_due = created_time + timedelta(hours=48)
        score, band, _ = priority_service.calculate_score(
            waste_type=req_data["type"],
            volume=req_data["vol"],
            created_at=created_time,
            sla_due_at=sla_due,
            nearby_count=0,
            now=now,
        )

        model = PickupRequestResponse(
            id=req_data["id"],
            reporter_id="seed_runner",
            latitude=req_data["lat"],
            longitude=req_data["lng"],
            address=req_data["addr"],
            waste_type=req_data["type"],
            volume=req_data["vol"],
            description=req_data["desc"],
            photo_url=None,
            status=req_data["status"],
            priority_score=score,
            priority_band=band,
            zone_id=req_data["zone"],
            duplicate_of=None,
            repeat_count=0,
            sla_due_at=sla_due,
            created_at=created_time,
            updated_at=now,
            history=[
                StatusHistoryItem(
                    id=f"hist-{req_data['id']}-1",
                    request_id=req_data["id"],
                    from_status=None,
                    to_status=RequestStatus.SUBMITTED.value,
                    actor_id="seed_runner",
                    note="Initial seed record",
                    created_at=created_time,
                )
            ],
        )
        if req_data["status"] == RequestStatus.VERIFIED:
            model.history.append(
                StatusHistoryItem(
                    id=f"hist-{req_data['id']}-2",
                    request_id=req_data["id"],
                    from_status=RequestStatus.SUBMITTED.value,
                    to_status=RequestStatus.VERIFIED.value,
                    actor_id="supervisor_seed",
                    note="Verified by supervisor",
                    created_at=created_time + timedelta(hours=1),
                )
            )

        await in_memory_repository.create(model)
        for h in model.history:
            await in_memory_repository.add_history(h)

    logger.info("Seeded %d Pickup Requests with priority scores and audit history", len(sample_requests))
    logger.info("Seed process completed successfully!")


if __name__ == "__main__":
    asyncio.run(seed_data())
