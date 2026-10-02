# ♻️ Smart Waste Collection Optimizer

A system that tracks **waste pickup requests on a map** and gives collection teams an **efficient, prioritized pickup plan**.

Citizens report waste on a map → the system scores each request by urgency → dispatchers generate optimized routes → collectors complete stops and upload proof.

> Docs: [PRD.md](./PRD.md) · [TRD.md](./TRD.md)

---

## ✨ Features

- 📍 Map-based pickup requests (pin drop, waste type, volume, photo)
- 🎯 Automatic **priority scoring** (hazard, age, volume, repeat reports, SLA risk)
- 🚛 **Route optimization** with vehicle capacity, shift time, and priority-weighted stop selection
- 🗺️ Priority-colored map with clustering and filters
- 👷 Collector route view with stop completion and proof photos
- 🔐 Role-based access: Reporter, Collector, Dispatcher, Admin
- 📊 Analytics: backlog, SLA, distance saved, hotspots
- ⚡ Real-time updates

## 🧱 Tech Stack

| Layer | Tech |
|---|---|
| Backend | Python, FastAPI, Pydantic, SQLAlchemy, Alembic |
| Optimization | Google OR-Tools, OSRM |
| Database | PostgreSQL + PostGIS |
| Frontend | React, Vite, TypeScript, Leaflet, Tailwind, TanStack Query |
| Auth | JWT + argon2, RBAC |
| DevOps | Docker, Docker Compose, GitHub Actions |

## 🗂️ Project Structure

```
smart-waste-optimizer/
├── backend/        # FastAPI app, optimizer, migrations, tests
├── frontend/       # React + Leaflet app
├── docker-compose.yml
├── PRD.md
├── TRD.md
└── README.md
```

## 🛣️ Development Roadmap (6 Phases)

Build order: **Backend → Database → Frontend → Auth**, then optimization and production polish.

| Phase | Focus | Features added |
|---|---|---|
| **1** | Backend foundation | REST API, request CRUD, lifecycle state machine, priority scoring, validation, tests, Swagger docs |
| **2** | Database | PostgreSQL + PostGIS, migrations, spatial queries (bbox, radius), duplicate detection, zones, seed data, CSV import |
| **3** | Frontend | Map UI, request form, priority-colored markers, clustering, filters, backlog table, detail drawer |
| **4** | Optimization | OR-Tools VRP planner, capacity and time constraints, plan builder UI, collector route view, stop completion |
| **5** | Authentication | JWT login, RBAC, route guards, user and team management, rate limiting, audit log |
| **6** | Production | WebSockets, notifications, analytics dashboard, auto re-plan, exports, CI/CD, monitoring |

### Progress Tracker

- [x] Phase 1 – Backend foundation
- [ ] Phase 2 – Database and geospatial
- [ ] Phase 3 – Frontend map and requests
- [ ] Phase 4 – Route optimization and dispatch
- [ ] Phase 5 – Authentication and authorization
- [ ] Phase 6 – Real-time, analytics, production

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 20+
- Docker and Docker Compose

### 1. Clone
```bash
git clone https://github.com/<your-username>/smart-waste-optimizer.git
cd smart-waste-optimizer
```

### 2. Configure environment
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

`backend/.env`
```env
DATABASE_URL=postgresql+psycopg://waste:waste@localhost:5432/waste_db
SECRET_KEY=change-me
ACCESS_TOKEN_EXPIRE_MINUTES=15
OSRM_URL=https://router.project-osrm.org
SOLVER_TIME_LIMIT_SECONDS=20
CORS_ORIGINS=http://localhost:5173
```

`frontend/.env`
```env
VITE_API_URL=http://localhost:8000/api/v1
```

### 3. Run with Docker (recommended, Phase 2+)
```bash
docker compose up --build
```
- API: http://localhost:8000
- API docs (Swagger): http://localhost:8000/docs
- Frontend: http://localhost:5173

### 4. Run manually

**Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
alembic upgrade head          # Phase 2+
python -m app.db.seed         # optional demo data
uvicorn app.main:app --reload
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

### 5. Run tests
```bash
cd backend && pytest
cd frontend && npm test
```

## 🔌 API Quick Look

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/requests` | Create pickup request |
| GET | `/api/v1/requests?status=verified&band=critical` | List and filter |
| GET | `/api/v1/requests/nearby?lat=19.99&lng=73.78&radius=500` | Spatial search |
| POST | `/api/v1/requests/{id}/transition` | Change status |
| POST | `/api/v1/plans/generate` | Generate optimized plan |
| GET | `/api/v1/routes/mine` | Collector's route |
| POST | `/api/v1/auth/login` | Login |

Example:
```bash
curl -X POST http://localhost:8000/api/v1/requests \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 19.9975,
    "longitude": 73.7898,
    "waste_type": "hazardous",
    "volume": "medium",
    "description": "Broken batteries near the market gate"
  }'
```

## 🎯 How Prioritization Works

```
score = 100 × (0.35·hazard + 0.25·age + 0.15·volume + 0.10·repeat + 0.15·sla_risk)
```

| Band | Score |
|---|---|
| 🔴 Critical | ≥ 75 |
| 🟠 High | 50–74 |
| 🟡 Medium | 25–49 |
| 🟢 Low | < 25 |

Weights are configurable by admins.

## 🚛 How Route Optimization Works

1. Gather verified open requests and selected vehicles.
2. Build a distance/time matrix (OSRM, with haversine fallback).
3. Solve a Capacitated VRP with time windows using OR-Tools.
4. Every stop is optional with a drop penalty proportional to its priority, so **high-priority stops are served first** and low-priority ones are deferred when capacity runs out.
5. Return ordered routes with ETAs, total distance, and any unserved requests.

## 👥 Roles

| Role | Can do |
|---|---|
| Reporter | Submit and track own requests |
| Collector | View assigned route, complete stops |
| Dispatcher | View all requests, generate and edit plans |
| Admin | Everything, plus users, teams, vehicles, zones, config |

## 🧪 Testing Strategy

- Unit tests for scoring, state machine, solver constraints
- API integration tests against PostGIS
- Playwright E2E: submit → verify → plan → collect
- Role-matrix security tests

## 🗺️ Future Ideas

- IoT bin-fill sensor ingestion
- Predictive hotspot forecasting
- Offline-first collector PWA
- Multi-city / multi-tenant support
- Carbon-emission savings reporting

## 🤝 Contributing

1. Fork and create a branch: `git checkout -b feature/your-feature`
2. Follow lint rules (`ruff`, `eslint`) and add tests
3. Open a pull request describing the change

## 📄 License

MIT (update as needed)
