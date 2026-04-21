# Akagera Aviation EFB

A production-grade, multi-tenant **Electronic Flight Bag** web application — a white-label alternative to Garmin Pilot / ForeFlight, built for helicopter flight schools, charter operators, and corporate aviation fleets.

---

## Architecture Overview

```
akagera/
├── apps/
│   ├── api/                    # NestJS backend (Node.js)
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Full multi-tenant DB schema
│   │   │   └── seed.ts         # Seed: Akagera fleet + W&B templates
│   │   └── src/
│   │       ├── auth/           # Clerk JWT guard + user provisioning
│   │       ├── tenants/        # Tenant management, pilot currency alerts
│   │       ├── aircraft/       # Fleet CRUD + stats
│   │       ├── flights/        # Flight logbook CRUD + summaries
│   │       ├── weather/        # Meteoblue + Windy tile proxy
│   │       ├── traffic/        # OpenSky ADS-B proxy (cached)
│   │       ├── documents/      # S3 upload/download (presigned URLs)
│   │       ├── wb/             # W&B calculator + envelope engine
│   │       └── routes/         # Route/flight plan storage
│   └── web/                    # React 19 + Vite frontend (PWA)
│       └── src/
│           ├── components/
│           │   ├── layout/     # AppShell, TopBar, StatusBar
│           │   ├── map/        # CesiumViewer, MapToolbar
│           │   └── efb/        # EFBPanel, WeatherPanel, W&B, Docs, Flights, Checklists
│           ├── hooks/          # useTraffic, useWeather
│           ├── store/          # Zustand: mapStore, authStore
│           └── lib/            # api.ts (typed client), utils.ts
├── docker-compose.yml          # PostgreSQL + Redis for local dev
└── .env.example                # All required environment variables
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- Docker (for PostgreSQL + Redis)
- Free [Cesium Ion](https://ion.cesium.com) account (terrain token)
- Optional: [Clerk](https://clerk.com) account for auth (app runs in demo mode without it)

### 1. Clone and install

```bash
git clone https://github.com/tmathias/akagera
cd akagera
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — at minimum set:
#   DATABASE_URL, VITE_CESIUM_ION_TOKEN
#   CLERK_SECRET_KEY + VITE_CLERK_PUBLISHABLE_KEY  (optional)
```

### 3. Start infrastructure

```bash
docker compose up -d       # starts PostgreSQL :5432 and Redis :6379
```

### 4. Run database migrations and seed

```bash
npm run db:migrate          # creates all tables
npm run db:generate         # regenerates Prisma client
cd apps/api
npm run db:seed             # seeds Akagera fleet, W&B templates, checklists
cd ../..
```

### 5. Start development servers

```bash
npm run dev
# API:  http://localhost:3001/api/v1
# Docs: http://localhost:3001/api/docs  (Swagger UI)
# Web:  http://localhost:5173
```

---

## Feature Reference

### Moving Map
| Feature | Implementation |
|---------|---------------|
| 3D terrain | Cesium World Terrain (Ion) — falls back to flat ellipsoid offline |
| Base layers | OSM streets, Bing satellite, OpenAIP VFR charts, OpenAIP IFR charts |
| Weather overlays | Windy animated tiles proxied through `/api/v1/weather/windy/:layer` |
| ADS-B traffic | OpenSky Network polled every 15 s via `/api/v1/traffic/states` |
| Route drawing | Click-to-place waypoints on map, distance calc, dashed polyline |
| Traffic icons | Cesium BillboardCollection — SVG icons with callsign/alt/speed labels |

### EFB Panel (sidebar)
| Tab | Features |
|-----|----------|
| **WX** | 24-h forecast charts (temp, wind, precipitation, cloud) from Meteoblue |
| **DOCS** | Upload PDFs/images to S3, browse by category/aircraft, in-app PDF.js viewer |
| **W&B** | Station weights → CG envelope chart → WITHIN/OUT OF LIMITS verdict |
| **LOG** | Logbook totals, flight list, inline quick-log form |
| **CKL** | Phase-based interactive checklists with critical item highlighting |

### Backend API (all behind Clerk JWT auth)
```
GET  /api/v1/weather/forecast?lat=&lon=
GET  /api/v1/weather/windy/:layer/:z/:x/:y   (tile proxy)
GET  /api/v1/traffic/states?lamin=&lamax=&lomin=&lomax=
GET  /api/v1/aircraft
POST /api/v1/aircraft
GET  /api/v1/flights
POST /api/v1/flights
GET  /api/v1/wb/templates
POST /api/v1/wb/calculate
POST /api/v1/documents/upload
GET  /api/v1/documents/:id/download          (presigned S3 URL)
GET  /api/v1/tenants/me/expiring-credentials
```

---

## PWA / Offline Mode

The Vite PWA plugin (Workbox) generates a service worker that:
- Pre-caches all JS/CSS/HTML bundles
- `StaleWhileRevalidate` for weather data (30 min TTL)
- `NetworkFirst` for live traffic data (30 s TTL)
- `CacheFirst` for Cesium terrain tiles (7 day TTL, up to 2,000 entries)
- `CacheFirst` for aeronautical chart tiles (24 h TTL, up to 5,000 entries)

Install from the browser ("Add to Home Screen") for full standalone mode on tablets.

---

## White-Label / Multi-Tenant

Each `Tenant` record isolates: aircraft, flights, documents, checklists, W&B templates, and users. Tenant branding (logo, primary colour) is stored per tenant.

To add a new tenant, either:
1. Let the first Clerk login auto-provision one based on email domain
2. Insert directly: `npm run db:studio` (Prisma Studio)

---

## Environment Variables

See [`.env.example`](.env.example) for full documentation.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis for caching |
| `CLERK_SECRET_KEY` | Backend JWT verification |
| `VITE_CLERK_PUBLISHABLE_KEY` | Frontend auth UI |
| `VITE_CESIUM_ION_TOKEN` | 3D terrain + satellite imagery |
| `AWS_*` | S3 document storage |
| `METEOBLUE_API_KEY` | Point forecast data |
| `WINDY_API_KEY` | Animated weather tile overlays |
| `OPENSKY_USERNAME/PASSWORD` | Higher rate limits on ADS-B data |

Without API keys the app automatically serves mock data.

---

## Scaling & Production Checklist

### Infrastructure
- [ ] Deploy API to **Railway / Fly.io / ECS Fargate** behind a load balancer
- [ ] Use **RDS PostgreSQL** (Multi-AZ) + **ElastiCache Redis** cluster
- [ ] Serve the Vite SPA from **CloudFront** (static S3 bucket)

### Performance
- [ ] Move traffic polling to a **WebSocket** push from the backend
- [ ] Enable Prisma connection pooling via **PgBouncer**
- [ ] Replace in-memory cache in WeatherService with `Redis SETEX` (multi-instance safe)

### Security
- [ ] Enable Clerk **organization-level** RBAC for Owner/Admin/Pilot roles
- [ ] Add S3 bucket policy: deny all public access, enforce SSL
- [ ] Enable CloudTrail + S3 server-access logging for document audit trail

### Offline / Certified EFB
- [ ] Pre-download VFR charts for offline use (Cesium offline terrain packs)
- [ ] Implement IndexedDB flight-log queue that syncs when online
- [ ] For FAA/EASA Part 135: add audit log table and tamper-evident W&B record signatures

### Planned Extensions
- [ ] NOTAM tab: pull from FAA NOTAM API / AIP providers
- [ ] Flight filing: connect to AFTN/AFPEX gateway
- [ ] Maintenance tracking: TBO intervals, AD compliance, component life limits
- [ ] Subdomain multi-tenancy: `{slug}.yourdomain.com` → resolve from host header

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 3 |
| Map | Cesium.js 1.122 (3D globe, terrain, entity system) |
| Charts | Recharts 2 (W&B envelope, weather graphs) |
| PDF | PDF.js 4 (in-browser document viewer) |
| State | Zustand 5 |
| Backend | NestJS 10, Node.js 20 |
| ORM | Prisma 5 + PostgreSQL 16 (PostGIS extension) |
| Auth | Clerk (multi-tenant JWT, RBAC) |
| Storage | AWS S3 (presigned upload/download URLs) |
| Cache | Redis (tile cache, rate-limit) |
| Weather | Meteoblue API + Windy Map API |
| Traffic | OpenSky Network ADS-B (free tier) |
| PWA | Vite PWA plugin (Workbox) |
| Dev ops | Docker Compose (local), Railway/Fly.io (prod) |
