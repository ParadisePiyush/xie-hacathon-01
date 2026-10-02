# Technical Requirements Document (TRD)
## Smart Waste Collection Optimizer

| Field | Value |
|---|---|
| Version | 1.0 |
| Companion | PRD.md |
| Build order | Backend → Database → Frontend → Auth |

---

## 1. Technology Stack

| Layer | Choice | Reason |
|---|---|---|
| Backend | **Python 3.11 + FastAPI** | Async, auto OpenAPI docs, best ecosystem for optimization |
| Validation | Pydantic v2 | Typed schemas |
| Optimization | **Google OR-Tools** (VRP) | Capacity, time windows, priority penalties |
| Database | **PostgreSQL 16 + PostGIS** | Spatial indexing and queries |
| ORM / Migrations | SQLAlchemy 2 + GeoAlchemy2 + Alembic | Standard, typed |
| Routing matrix | OSRM (self-hosted or public demo), haversine fallback | Real road distances |
| Frontend | **React 18 + Vite + TypeScript** | Fast dev, typed |
| Map | Leaflet (react-leaflet) + OpenStreetMap tiles | Free, no API key |
| State / data | TanStack Query + Zustand | Server-state caching |
| UI | Tailwind CSS | Rapid, consistent styling |
| Auth | JWT (python-jose), argon2 hashing | Stateless, RBAC |
| Real-time | WebSocket (FastAPI) | Live updates |
| Testing | pytest, httpx, Vitest, Playwright | Unit, API, E2E |
| DevOps | Docker, Docker Compose, GitHub Actions | Reproducible builds |

> Alternative: Node.js + Express/NestJS works for the API, but the solver would then need a Python microservice. FastAPI keeps it in one codebase.

## 2. System Architecture

```
┌────────────────────┐      HTTPS       ┌───────────────────────────┐
│  React SPA (Vite)  │ ───────────────► │  FastAPI Application      │
│  Leaflet map       │ ◄─ WebSocket ──► │  ├─ API routers           │
└────────────────────┘                  │  ├─ Services (logic)      │
                                        │  │   ├─ PriorityService   │
                                        │  │   ├─ PlanningService   │
                                        │  │   └─ AuthService       │
                                        │  ├─ Repositories          │
                                        │  └─ Optimizer (OR-Tools)  │
                                        └──────┬─────────────┬──────┘
                                               │             │
                                  ┌────────────▼───┐   ┌─────▼──────┐
                                  │ PostgreSQL +   │   │   OSRM     │
                                  │ PostGIS        │   │ (distance) │
                                  └────────────────┘   └────────────┘
```

**Pattern:** layered architecture: `router → service → repository`. Routers contain no business logic. Repositories hide storage, so Phase 1 uses an in-memory repo and Phase 2 swaps in PostgreSQL without touching services.

## 3. Repository Structure

```
smart-waste-optimizer/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/            # config, security, logging
│   │   ├── api/v1/          # routers: requests, plans, teams, auth, analytics
│   │   ├── schemas/         # Pydantic models
│   │   ├── models/          # SQLAlchemy models
│   │   ├── services/        # priority, planning, auth, notifications
│   │   ├── repositories/    # interfaces + memory + postgres
│   │   ├── optimizer/       # distance matrix, vrp solver
│   │   └── db/              # session, migrations (alembic)
│   ├── tests/
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── components/      # Map, RequestForm, Backlog, RouteView
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── api/             # typed API client
│   │   └── store/
│   └── package.json
├── docker-compose.yml
├── PRD.md  TRD.md  README.md
└── .github/workflows/ci.yml
```

## 4. Data Model

### 4.1 Tables

| Table | Key columns |
|---|---|
| `users` | id, email (unique), password_hash, full_name, role, team_id, is_active, created_at |
| `teams` | id, name, depot_id |
| `vehicles` | id, team_id, plate, capacity_units, shift_start, shift_end, is_active |
| `depots` | id, name, location `geometry(Point,4326)` |
| `zones` | id, name, boundary `geometry(Polygon,4326)` |
| `pickup_requests` | id, reporter_id, location `geometry(Point,4326)`, address, waste_type, volume, description, photo_url, status, priority_score, priority_band, zone_id, duplicate_of, sla_due_at, created_at, updated_at |
| `request_status_history` | id, request_id, from_status, to_status, actor_id, note, created_at |
| `plans` | id, plan_date, created_by, status, total_distance_m, total_duration_s, created_at |
| `routes` | id, plan_id, vehicle_id, distance_m, duration_s, polyline |
| `route_stops` | id, route_id, request_id, sequence, eta, outcome, outcome_reason, proof_photo_url, completed_at |
| `config` | key, value (JSON): priority weights, SLA hours, service times |
| `audit_log` | id, user_id, action, entity, entity_id, payload, created_at |

### 4.2 Enums
- `waste_type`: general, recyclable, hazardous, medical, e_waste, organic, construction
- `volume`: small, medium, large, overflow
- `status`: submitted, verified, planned, in_progress, collected, skipped, rejected, cancelled
- `role`: reporter, collector, dispatcher, admin

### 4.3 Indexes
- GiST on `pickup_requests.location`, `zones.boundary`, `depots.location`
- B-tree on `(status, priority_score DESC)`, `created_at`, `zone_id`
- Unique `(route_id, sequence)` on `route_stops`

## 5. API Specification (v1)

Base path: `/api/v1`. All responses JSON. Errors use `{ "error": { "code": "...", "message": "...", "details": {} } }`.

### 5.1 Pickup Requests (Phase 1–2)
| Method | Path | Description | Role (Phase 5) |
|---|---|---|---|
| POST | `/requests` | Create request | reporter+ |
| GET | `/requests` | List, filter: `status,type,band,zone,bbox,from,to`, sort, paginate | reporter (own), dispatcher+ (all) |
| GET | `/requests/{id}` | Detail with history | owner/dispatcher+ |
| PATCH | `/requests/{id}` | Update fields | owner (pre-verify)/dispatcher+ |
| POST | `/requests/{id}/transition` | `{to_status, note}` | dispatcher+/collector (limited) |
| DELETE | `/requests/{id}` | Cancel | owner/dispatcher+ |
| GET | `/requests/nearby?lat=&lng=&radius=` | Spatial search | dispatcher+ |
| POST | `/requests/import` | CSV bulk import | admin |

### 5.2 Planning (Phase 4)
| Method | Path | Description |
|---|---|---|
| POST | `/plans/generate` | `{date, team_ids, vehicle_ids, request_ids?}` → plan |
| GET | `/plans/{id}` | Plan with routes and stops |
| PATCH | `/plans/{id}/routes/{rid}` | Manual reorder/reassign |
| POST | `/plans/{id}/reoptimize` | Re-run with locked stops |
| POST | `/plans/{id}/publish` | Make visible to collectors |
| GET | `/routes/mine` | Collector's current route |
| POST | `/route-stops/{id}/complete` | `{outcome, reason?, photo}` |

### 5.3 Resources (Phase 2+)
`/teams`, `/vehicles`, `/depots`, `/zones`, `/config/priority` (CRUD, admin).

### 5.4 Auth (Phase 5)
`POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `/users` (admin CRUD).

### 5.5 Analytics & Realtime (Phase 6)
`GET /analytics/summary`, `/analytics/heatmap`, `/analytics/teams`, `WS /ws/updates`.

## 6. Core Algorithms

### 6.1 Priority Scoring
Implemented in `PriorityService.score(request, now, nearby_count, config)` as a pure function (easy to unit test). Formula and weights are in PRD §6. Scores are recomputed:
- on create/update, and
- by a scheduled job every 15 minutes (age and SLA change over time).

### 6.2 Duplicate Detection (Phase 2)
On create, query open requests of the same type within 50 m and 24 h using `ST_DWithin(location::geography, point::geography, 50)`. If found, link `duplicate_of` and increment the parent's repeat factor instead of creating a separate stop.

### 6.3 Route Optimization (Phase 4)
Modeled as a **Capacitated VRP with Time Windows and Optional Nodes**:

1. **Inputs:** open `verified` requests, selected vehicles, depot(s).
2. **Distance matrix:** OSRM `/table` (durations and distances); fallback haversine × 1.3 detour factor at 30 km/h.
3. **Model (OR-Tools `RoutingModel`):**
   - Arc cost = travel distance.
   - Capacity dimension: volume units (small=1, medium=2, large=4, overflow=6).
   - Time dimension: travel + service time; vehicle shift window; per-request SLA window.
   - **Disjunctions:** every request is optional, with drop penalty = `priority_score × K` (K large, e.g., 1000). This makes the solver serve high-priority stops first and drop low-priority ones when capacity or time runs out.
4. **Search:** first solution `PATH_CHEAPEST_ARC`, metaheuristic `GUIDED_LOCAL_SEARCH`, time limit 20 s (configurable).
5. **Output:** ordered stops with ETA per vehicle, unserved list, totals. Stored in `plans`, `routes`, `route_stops`.
6. **Re-optimize:** locked (in-progress/manual-pinned) stops are fixed in sequence; remaining stops re-solved.

Complexity guard: above 500 stops, cluster by zone (k-means or zone polygons) and solve each cluster independently.

### 6.4 Request State Machine
Allowed transitions are held in a dictionary and enforced in `RequestService.transition()`; invalid moves return `409 Conflict`.

## 7. Frontend Technical Design

- **Pages:** Map Dashboard, Submit Request, Backlog, Plan Builder, My Route, Analytics, Admin, Login.
- **Map layer:** marker clusters; color by priority band; polylines per route in distinct colors; numbered stop markers.
- **Data fetching:** TanStack Query with bbox-based queries (refetch on map move, debounced 400 ms).
- **Forms:** React Hook Form + Zod, shared types generated from the OpenAPI schema (`openapi-typescript`).
- **Auth (Phase 5):** access token in memory, refresh token in httpOnly cookie, `<RequireRole>` route guard, Axios interceptor for refresh.
- **Realtime (Phase 6):** WebSocket hook invalidates relevant queries on events.

## 8. Authentication and Security (Phase 5)

| Concern | Approach |
|---|---|
| Password storage | argon2id |
| Tokens | Access JWT 15 min, refresh JWT 7 days, rotated and revocable (stored hashed) |
| Authorization | FastAPI dependency `require_roles(...)`; row-level checks for ownership |
| Transport | HTTPS only, HSTS |
| Input | Pydantic validation, parameterized SQL via ORM |
| Uploads | Type/size check (JPEG/PNG ≤ 5 MB), random filenames, object storage (S3/MinIO) |
| Abuse | Rate limiting (slowapi): 5/min login, 30/min create request |
| CORS | Allow-list of frontend origins |
| Secrets | Environment variables, never committed |
| Audit | Log logins, role changes, plan publishes, status overrides |

## 9. Non-Functional Technical Targets

| Item | Target |
|---|---|
| API p95 latency (reads) | < 300 ms at 50k requests |
| Plan solve time | ≤ 30 s for 300 stops / 10 vehicles |
| Test coverage | ≥ 80% backend services, key UI flows covered by E2E |
| Logging | JSON structured logs with request IDs |
| Config | 12-factor, `.env` driven |
| Backups | Daily `pg_dump`, 7-day retention |

## 10. Phase-wise Technical Deliverables

| Phase | Deliverables | Exit criteria |
|---|---|---|
| **1. Backend** | FastAPI skeleton, schemas, in-memory repo, PriorityService, state machine, tests | All Phase 1 endpoints pass tests; Swagger docs live |
| **2. Database** | Docker Postgres+PostGIS, Alembic migrations, Postgres repo, spatial endpoints, duplicate detection, seed script | Same tests pass against Postgres; nearby/bbox queries use GiST index |
| **3. Frontend** | Vite app, map, request form, filters, backlog, detail drawer | A reporter can submit and a dispatcher can view and filter on map |
| **4. Optimization** | Distance matrix service, VRP solver, plan endpoints, plan builder UI, collector route view | Plan produced for seeded dataset; routes drawn; stop completion works |
| **5. Auth** | Auth service, JWT, RBAC, user admin, route guards, rate limiting, audit log | Unauthorized access returns 401/403; role matrix verified by tests |
| **6. Production** | WebSocket, notifications, analytics, auto re-plan, export, CI/CD, monitoring | One-command deploy; load test meets targets |

## 11. Testing Strategy

- **Unit:** priority scoring, state machine, matrix fallback, solver constraints.
- **Integration:** API + Postgres via Testcontainers or Compose.
- **Solver tests:** fixed seeds; assert capacity never exceeded, high-priority stops served over low, all routes start/end at depot.
- **E2E (Playwright):** submit → verify → plan → collect.
- **Security:** role-matrix tests, dependency scan (pip-audit, npm audit).

## 12. Deployment

- **Local:** `docker compose up` (api, db, frontend, osrm optional, minio optional).
- **CI:** lint (ruff, eslint), type-check (mypy, tsc), tests, build images.
- **Prod (suggested):** containerized API behind Nginx/Traefik, managed Postgres with PostGIS, static frontend on CDN, object storage for photos.

## 13. Risks and Technical Decisions

| Decision / Risk | Notes |
|---|---|
| Optional-node VRP with priority penalties | Gives a prioritized plan instead of failing when over capacity |
| OSRM dependency | Public demo server is rate-limited; self-host for production |
| PostGIS adds ops weight | Worth it for spatial indexing, geography distance, polygons |
| Solver blocking the API | Run solve in a background worker (thread pool / Celery) and poll plan status if > 5 s |
| Time-varying priority | Scheduled recompute job avoids stale scores |
