# Cauto Command Centre — Project Guide
**Last updated:** April 2026 | **Status:** Development — mock data, auth + RBAC done

---

## What's built

| Layer | Status | Notes |
|---|---|---|
| React frontend | ✅ Done | `CautoCommandCentre.jsx` |
| Node/Express backend | ✅ Done | `cauto-backend/` |
| JWT auth | ✅ Done | Login, session, logout |
| Role-based access (RBAC) | ✅ Done | 4 roles, live permissions matrix |
| Admin panel | ✅ Done | Edit permissions + manage users from UI |
| GPS adapter (mock) | ✅ Done | Visirun + Targa stubs ready |
| GPS adapter (live) | 🔒 Blocked | Waiting: Visirun API key |
| Fuel / workshop data | 🔒 Blocked | Waiting: IT → TargetCross DB access |
| Night shift trucks | 🔒 Blocked | Waiting: Aprica → Targa authorization |
| Deployment | ⏳ Next | VPS setup |

---

## Prerequisites

Install these before anything else:

- **Node.js** v18+ → https://nodejs.org (choose LTS)
- **VSCode** → https://code.visualstudio.com
- **VSCode extensions** (install from Extensions panel):
  - `ESLint`
  - `Prettier`
  - `ES7+ React/Redux/React-Native snippets`
(
Verify Node is installed:
```bash
node --version   # should print v18 or higher
npm --version
```

---

## Project structure

```
cauto/
├── cauto-frontend/          ← React app (create this)
│   ├── src/
│   │   └── App.jsx          ← paste CautoCommandCentre.jsx here
│   └── package.json
│
└── cauto-backend/           ← Express API (already built)
    ├── src/
    │   ├── index.js         ← server entry point
    │   ├── adapters/
    │   │   ├── index.js     ← picks GPS provider from .env
    │   │   ├── gps.mock.js  ← active now
    │   │   ├── gps.visirun.js  ← ready, needs API key
    │   │   └── gps.targa.js    ← ready, needs Aprica auth
    │   ├── data/
    │   │   ├── users.js        ← user store (move to DB later)
    │   │   └── permissions.js  ← live RBAC matrix
    │   ├── middleware/
    │   │   └── auth.js         ← JWT + live permission check
    │   └── routes/
    │       ├── auth.js         ← login / me / logout
    │       ├── gps.js
    │       ├── workshop.js
    │       ├── fuel.js
    │       ├── suppliers.js
    │       ├── costs.js
    │       ├── permissions.js  ← GET/PATCH matrix
    │       └── users-admin.js  ← CRUD users (fleet_manager only)
    ├── .env.example
    └── package.json
```

---

## First-time setup

### 1 — Backend

```bash
cd cauto-backend
npm install
cp .env.example .env
```

Open `.env` and set at minimum:
```
JWT_SECRET=pick_anything_long_and_random_here
GPS_PROVIDER=mock
```

### 2 — Frontend

```bash
npm create vite@latest cauto-frontend -- --template react
cd cauto-frontend
npm install
```

Replace `src/App.jsx` with `CautoCommandCentre.jsx`.

---

## Running the project (every session)

Open VSCode. Open two terminals (`Ctrl+` ` then the + button).

**Terminal 1 — backend:**
```bash
cd cauto-backend
npm run dev
# → running on http://localhost:3001
```

**Terminal 2 — frontend:**
```bash
cd cauto-frontend
npm run dev
# → running on http://localhost:5173
```

Open `http://localhost:5173` in browser.

---

## Test accounts

| Email | Password | Role |
|---|---|---|
| erwan@cauto.it | cauto2026 | Fleet Manager (full access) |
| officina@cauto.it | workshop123 | Resp. Officina |

Create more users from the Admin panel inside the app.

---

## API endpoints

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Login |
| GET | `/api/auth/me` | Auth | Current user |
| GET | `/api/gps/vehicles` | view | All vehicles (polls every 10s) |
| GET | `/api/workshop/orders` | view | Work orders |
| PATCH | `/api/workshop/orders/:id` | edit | Update order |
| GET | `/api/fuel/entries` | view | Fuel log |
| GET | `/api/fuel/summary` | view | KPIs |
| GET | `/api/suppliers` | view | Supplier list |
| GET | `/api/costs/monthly` | view | Cost breakdown |
| GET | `/api/permissions` | Auth | Read permission matrix |
| PATCH | `/api/permissions` | fleet_manager | Update matrix (live) |
| GET | `/api/admin/users` | fleet_manager | List users |
| POST | `/api/admin/users` | fleet_manager | Create user |
| PATCH | `/api/admin/users/:id` | fleet_manager | Update user / role |
| DELETE | `/api/admin/users/:id` | fleet_manager | Deactivate user |

---

## Roles

| Role (code) | Label UI |
|---|---|
| `fleet_manager` | Fleet Manager |
| `responsabile_officina` | Resp. Officina |
| `coordinatore_officina` | Coord. Officina |
| `coordinatore_operativo` | Coord. Operativo |

Permission levels: `none` → `view` → `edit` → `full`

Default matrix (editable from app → Admin → Permessi):

| | Fleet Mgr | Resp. Officina | Coord. Officina | Coord. Operativo |
|---|---|---|---|---|
| GPS | full | view | view | full |
| Officina | full | full | edit | view |
| Carburante | full | none | none | full |
| Fornitori | full | view | none | view |
| Costi | full | none | none | view |

---

## Unblocking live data (when the time comes)

### Visirun GPS
1. Get API key from Verizon Connect
2. In `.env`:
```
GPS_PROVIDER=visirun
VISIRUN_API_URL=https://api.visirun.com/v2
VISIRUN_API_KEY=your_key_here
VISIRUN_FLEET_ID=your_fleet_id
```
3. Restart backend. Done — no code changes.

### Targa / Aprica (night shift trucks)
1. Aprica grants read-only access to Cauto vehicles
2. In `.env`:
```
GPS_PROVIDER=targa
TARGA_API_URL=https://api.targatelematics.com/v1
TARGA_USERNAME=your_user
TARGA_PASSWORD=your_pass
TARGA_ACCOUNT_ID=your_account
```

### TargetCross DB (fuel + workshop live data)
1. IT grants DB access
2. Add to `.env`:
```
DB_ENABLED=true
DB_HOST=server_address
DB_PORT=1433
DB_NAME=TargetCross
DB_USER=your_user
DB_PASSWORD=your_pass
```
3. Replace mock data in `routes/fuel.js` and `routes/workshop.js` with real SQL queries.

---

## Continuing with Claude

Paste this file at the start of any new session and say where you want to pick up.
Claude has full context on architecture, decisions already made, and what's blocked.

**Sessions so far covered:**
- Project scope and architecture decisions
- GPS adapter pattern (Visirun / Targa)
- React shell — all 6 modules
- Node/Express backend — all routes + mock data
- Frontend wired to backend (fetch + loading/error states)
- JWT auth — login screen, session, auto-logout on expiry
- RBAC — 4 roles, live permissions matrix, admin panel
- User management — create / edit / deactivate from UI

**Next logical steps:**
1. ~~Deployment~~ ✅ Done (see Deployment section below)
2. TargetCross DB connection (when IT clears it)
3. Visirun live GPS (when credentials arrive)

---

## Deployment

The app is deployed as two separate services:

| Service | Platform | URL |
|---|---|---|
| Frontend (React) | GitHub Pages | `https://argali.github.io/FleetCC` |
| Backend (Express) | Render (free tier) | `https://fleetcc-backend.onrender.com` |

### First-time Render setup

1. Go to [render.com](https://render.com) → New → **Blueprint** → connect the repo
2. Render reads `render.yaml` and creates the `fleetcc-backend` service automatically
3. In the Render dashboard, go to the service → **Environment** and set these manually:

| Variable | Value |
|---|---|
| `FRONTEND_URL` | `https://argali.github.io/FleetCC` |
| `SEED_SUPERADMIN_EMAIL` | e.g. `superadmin@yourdomain.com` |
| `SEED_SUPERADMIN_PASSWORD` | Strong random password |
| `SEED_OFFICINA_PASSWORD` | Strong random password |
| `SEED_ADMIN_PASSWORD` | Strong random password |

> `JWT_SECRET` is auto-generated by Render — do not set it manually.

4. Trigger a manual deploy. The service starts in ~1 minute.
5. Verify: `curl https://fleetcc-backend.onrender.com/health` → `{"status":"ok","uptime":...}`

### First-time GitHub Pages setup

1. In the GitHub repo → **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|---|---|
| `VITE_API_URL` | `https://fleetcc-backend.onrender.com/api` |

2. In **Settings → Pages**, set source to **GitHub Actions**
3. Push to `main` — the workflow builds and deploys automatically

### Verifying end-to-end

```bash
# 1. Backend alive?
curl https://fleetcc-backend.onrender.com/health

# 2. CORS correct? (should return data, not a CORS error)
curl -H "Origin: https://argali.github.io" https://fleetcc-backend.onrender.com/health

# 3. Open the app and log in
# https://argali.github.io/FleetCC
```

### Important: Render free tier spin-down

The free tier shuts down after **15 minutes of inactivity**. The first request after idle takes 30–50 seconds to wake up. This is normal. Options:
- Upgrade to Render Starter ($7/mo) for always-on
- Use [UptimeRobot](https://uptimerobot.com) (free) to ping `/health` every 5 minutes and keep it warm

### DEV vs production

The sidebar shows a small **DEV** badge when the frontend is connected to `localhost`. In production (GitHub Pages + Render), the badge is invisible.
