# Product Requirements Document (PRD)
## Smart Waste Collection Optimizer

| Field | Value |
|---|---|
| Version | 1.0 |
| Status | Draft |
| Build order | Backend → Database → Frontend → Auth |
| Delivery | 6 phases |

---

## 1. Overview

Smart Waste Collection Optimizer is a web system that lets citizens, staff, or sensors raise **waste pickup requests on a map**, and gives **collection teams an efficient, prioritized pickup plan** for each shift.

Today, many municipalities and campuses dispatch teams using fixed routes or phone/WhatsApp messages. This causes missed hazardous waste, overflowing bins, wasted fuel, and no visibility into what was collected. This product replaces that with a single map-centric workflow: **report → prioritize → plan → collect → verify**.

## 2. Problem Statement

- Pickup requests arrive from many channels with no central view.
- Teams cannot tell which requests are most urgent (hazardous, overflowing, long-pending).
- Routes are planned by hand, so travel distance and time are higher than needed.
- Supervisors have no data on SLA, backlog, or team productivity.

## 3. Goals and Non-Goals

### Goals
1. Capture pickup requests with an exact map location, waste type, and volume.
2. Automatically compute a **priority score** for every request.
3. Generate an **optimized, ordered route** per team/vehicle, respecting capacity and shift time.
4. Track each request through its lifecycle with a full audit trail.
5. Provide role-based access for citizens, collectors, and admins.

### Non-Goals (v1)
- Payments or billing.
- IoT hardware integration (a bin-sensor ingestion endpoint is a future extension).
- Native mobile apps (a mobile-responsive web view is in scope).
- Real-time turn-by-turn navigation (we link out to Google/OSM navigation).

## 4. Users and Personas

| Persona | Description | Key needs |
|---|---|---|
| **Citizen / Reporter** | Raises a pickup request | Easy submit on map, see status |
| **Collector (Driver/Crew)** | Executes the route | Clear ordered stops, mark done, upload proof |
| **Dispatcher / Supervisor** | Plans and monitors | Prioritized backlog, generate plans, reassign |
| **Admin** | Manages system | Users, teams, vehicles, zones, config |

## 5. Core User Stories

**Reporter**
- As a reporter, I can drop a pin on the map, choose waste type and volume, optionally attach a photo, and submit.
- As a reporter, I can track my request status.

**Dispatcher**
- As a dispatcher, I can see all open requests on a map, colored by priority.
- As a dispatcher, I can generate an optimized plan for a date, choosing teams and vehicles.
- As a dispatcher, I can manually adjust stops and re-optimize.

**Collector**
- As a collector, I can view my assigned route as an ordered list and on the map.
- As a collector, I can mark a stop collected / skipped (with reason) and attach a photo.

**Admin**
- As an admin, I can manage users, roles, teams, vehicles, depots, and priority weights.

## 6. Priority Scoring (Product Rule)

Each open request gets a score from 0–100:

```
score = 100 * ( w_h * hazard + w_a * age + w_v * volume + w_r * repeat + w_s * sla_risk )
```

| Factor | Normalized 0–1 | Default weight |
|---|---|---|
| `hazard` – waste type (hazardous=1.0, medical=0.9, e-waste=0.6, general=0.3, recyclable=0.2) | by type | 0.35 |
| `age` – hours since reported / max SLA hours | capped at 1 | 0.25 |
| `volume` – small/medium/large/overflow | 0.25/0.5/0.75/1 | 0.15 |
| `repeat` – other open reports within 50 m | capped at 1 | 0.10 |
| `sla_risk` – time left before SLA breach | inverse | 0.15 |

Weights are admin-configurable. Priority bands: **Critical ≥ 75, High 50–74, Medium 25–49, Low < 25**.

## 7. Request Lifecycle

```
SUBMITTED → VERIFIED → PLANNED → IN_PROGRESS → COLLECTED
                  ↘ REJECTED            ↘ SKIPPED (reason) → re-queued
```

Every transition is recorded with actor and timestamp.

## 8. Phased Delivery Plan (6 Phases)

Each phase ends with a demoable increment and adds features on top of the last.

### Phase 1 — Backend Foundation
**Goal:** a working API with business logic, no persistence dependency yet.
- REST API (FastAPI) with OpenAPI docs
- Pickup request CRUD (create, list, get, update, cancel)
- Request lifecycle state machine and validation
- **Priority scoring engine** (configurable weights)
- Input validation, error format, logging, health check
- Repository interface with in-memory implementation
- Unit tests for scoring and state machine

### Phase 2 — Database & Geospatial Layer
**Goal:** durable storage and spatial queries.
- PostgreSQL + PostGIS, schema migrations (Alembic)
- Tables: requests, status history, teams, vehicles, depots, zones
- Spatial queries: requests in bounding box, within radius, nearest depot
- **Duplicate detection** (same type within 50 m / 24 h → merge as repeat report)
- Zone assignment via point-in-polygon
- Seed data and a bulk-import CSV endpoint
- Indexing (GiST on geometry), pagination, filtering, sorting

### Phase 3 — Frontend: Map & Request Management
**Goal:** a usable map UI for reporters and dispatchers.
- React + Vite + Leaflet/MapLibre map
- Submit request form (pin drop, geolocation, photo upload)
- Priority-colored markers, marker clustering
- Filters (status, type, priority, zone, date)
- Request detail drawer with status timeline
- Dispatcher backlog table synced with map
- Responsive/mobile-friendly layout

### Phase 4 — Route Optimization & Dispatch
**Goal:** the core value: the prioritized pickup plan.
- Vehicle Routing Problem solver (Google OR-Tools)
- Constraints: vehicle capacity, shift time window, depot start/end, per-stop service time
- Objective: minimize distance while **dropping lowest-priority stops first** (priority-weighted penalties)
- Distance/time matrix via OSRM (fallback: haversine)
- Plan generation API and UI: choose date, teams, vehicles → view colored routes on map
- Manual reorder/reassign + re-optimize
- Plan summary: stops, distance, estimated duration, unserved requests
- Collector route view (ordered stops, mark collected/skipped, proof photo)

### Phase 5 — Authentication & Authorization
**Goal:** secure the system and enforce roles.
- JWT access + refresh tokens, password hashing (argon2/bcrypt)
- Roles: Reporter, Collector, Dispatcher, Admin (RBAC)
- Route guards in UI, protected endpoints
- Ownership rules (reporters see only own requests; collectors see only own routes)
- User management and team assignment (admin)
- Rate limiting, CORS, security headers, audit log
- Optional: Google OAuth login

### Phase 6 — Real-Time, Analytics & Production Readiness
**Goal:** polish, insight, and deployment.
- Live updates via WebSocket/SSE (new requests, status changes, collector progress)
- Notifications (email/SMS/webhook) on status change
- Analytics dashboard: backlog, avg response time, SLA %, km saved vs. baseline, per-team productivity, hotspot heatmap
- Auto re-plan when a Critical request arrives mid-shift
- CSV/PDF export of plans and reports
- Docker Compose, CI/CD, monitoring, backups
- Load testing and documentation

## 9. Functional Requirements Summary

| ID | Requirement | Phase |
|---|---|---|
| FR-1 | Create/read/update/cancel pickup requests | 1 |
| FR-2 | Compute and expose priority score and band | 1 |
| FR-3 | Enforce request lifecycle transitions | 1 |
| FR-4 | Persist data with spatial indexing | 2 |
| FR-5 | Detect duplicate/nearby requests | 2 |
| FR-6 | Map-based request submission | 3 |
| FR-7 | Filterable, priority-colored map view | 3 |
| FR-8 | Generate optimized multi-vehicle plan | 4 |
| FR-9 | Collector marks stop outcome with proof | 4 |
| FR-10 | Login, roles, protected resources | 5 |
| FR-11 | Real-time updates and notifications | 6 |
| FR-12 | Analytics dashboard and exports | 6 |

## 10. Non-Functional Requirements

| Area | Target |
|---|---|
| Performance | List/map queries < 300 ms p95 for 50k requests; plan for 300 stops / 10 vehicles < 30 s |
| Availability | 99.5% for the API |
| Security | OWASP Top 10 baseline, hashed passwords, least-privilege roles |
| Usability | Request submit in under 30 seconds; mobile usable |
| Scalability | Stateless API, horizontally scalable |
| Observability | Structured logs, health/metrics endpoints |
| Accessibility | WCAG 2.1 AA for core flows |

## 11. Success Metrics

- Total route distance reduced by **≥ 20%** vs. unoptimized baseline.
- **100%** of Critical requests collected within SLA.
- Average time from report to collection reduced by **≥ 25%**.
- Plan generation under 30 seconds for typical daily load.
- Request submission completion rate ≥ 90%.

## 12. Assumptions and Risks

| Risk | Mitigation |
|---|---|
| OSRM/maps service unavailable | Haversine fallback with a visible warning |
| Large plans exceed solver time | Time-limited solve, return best-so-far solution |
| Spam or false requests | Verification step, rate limiting, reporter reputation (future) |
| Inaccurate GPS pins | Allow pin adjustment, reverse-geocoded address shown |
| Scope creep | Strict phase gates; features outside a phase go to backlog |

## 13. Open Questions

1. Single city/campus or multi-tenant?
2. Is a request SLA fixed or per waste type?
3. Do collectors work offline (needs PWA caching)?
4. Is there an existing GIS/zone dataset to import?
