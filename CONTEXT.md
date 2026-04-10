# FleetCC — Project Context

## What is FleetCC

A fleet management web app (React + Node.js) deployed on GitHub Pages (frontend) and Render.com (backend).

- **Repo:** https://github.com/Argali/FleetCC
- **Live app:** https://argali.github.io/FleetCC/
- **Backend:** Render.com (see `render.yaml`)
- **Auth:** Microsoft Azure AD (MSAL), token stored in `sessionStorage`

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React (JSX, Vite), Leaflet.js, `@azure/msal-browser` |
| Backend | Node.js / Express |
| Auth | Azure AD (MSAL) → JWT verified server-side |
| Maps | Leaflet (direct imperative API, no react-leaflet) |
| Geocoding | Nominatim (OpenStreetMap) — no API key needed |
| Deploy | GitHub Actions → `actions/deploy-pages@v4`, `BASE_PATH: /FleetCC` |

---

## Project Structure

```
cauto-frontend/
  src/
    App.jsx          ← entire frontend (single file, ~1700 lines)
    msalConfig.js    ← MSAL config (client ID, tenant, redirect URI)
    main.jsx         ← React entry point
  vite.config.js
  dist/              ← gitignored, built by CI

cauto-backend/
  src/
    index.js         ← Express app entry
    middleware/
      auth.js        ← JWT check middleware
      azureAuth.js   ← Azure token validation
    routes/
      auth.js        ← /api/auth/* (login, Azure callback)
      gps.js         ← /api/gps/vehicles, /routes
      workshop.js    ← /api/workshop
      fuel.js        ← /api/fuel
      suppliers.js   ← /api/suppliers
      costs.js       ← /api/costs
      permissions.js ← /api/permissions
      users-admin.js ← /api/users-admin
      segnalazioni.js← /api/segnalazioni
      reports.js     ← /api/reports
    data/
      users.js       ← user list (add users here)
      permissions.js ← permission matrix
    adapters/
      gps.mock.js    ← mock GPS data
      index.js       ← adapter selector
  .env               ← secrets (not committed)
  .env.example       ← template

.github/workflows/deploy.yml  ← CI/CD pipeline
```

---

## Authentication Flow

1. User lands on app → sees login button
2. Clicks login → MSAL popup (Azure AD)
3. Azure returns token → frontend sends to `/api/auth/azure`
4. Backend validates token → returns session JWT
5. JWT stored in `sessionStorage` as `cauto_auth`
6. All API calls send `Authorization: Bearer <jwt>`

**Adding a user:** Edit `cauto-backend/src/data/users.js` — add Azure email to the allowed list.

---

## Frontend Architecture (`App.jsx`)

### Theme
All colors in `const T = { sidebar, bg, card, ... }` at top of file.

### Context
- `AuthContext` — `{ auth, login, logout }`, persisted in `sessionStorage`
- `PermContext` — `{ perms, can(module, level), matrix, roles, levels }`

### Permission levels
`none → view → edit → full`

### Main modules (tabs in sidebar)
| Key | Component |
|-----|-----------|
| `gps` | `GPSModule` |
| `workshop` | `WorkshopModule` |
| `fuel` | `FuelModule` |
| `suppliers` | `SuppliersModule` |
| `costs` | `CostsModule` |
| `reports` | `ReportsModule` |
| `segnalazioni` | `SegnalazioniModule` |
| `admin` | `AdminModule` (permissions matrix) |

---

## GPS Module — Detailed

The most complex module. Four sub-tabs:

| Tab key | Description |
|---------|-------------|
| `live` | Live map with vehicle positions, overlays, legend |
| `editor` | Route (percorsi) editor |
| `zone` | Zone editor (polygons on map) |
| `punti` | Point-of-interest editor |

### GPS Live features
- **Left collapsible panel** (`livePanelOpen` state) — vehicle list with Comune/Settore filters
- **Legend** (top-right) — toggles per layer: Percorsi, Zone, Punti
- **Address search** — Nominatim API, fly-to with red pin marker
- **Visibility state:** `visibleRoutes`, `visibleZones`, `visiblePunti` (id → boolean)

### Zone drawing (multi-click, no drag)
```js
const ZONE_CLICKS = { circle: 2, square: 2, triangle: 3, parallelogram: 4 };
```
- Live cursor preview on `mousemove`
- Vertices accumulated on `click`
- Shape finalized when `clickVerts.length >= ZONE_CLICKS[type]`

### Data persistence
- Routes (`percorsi`): `localStorage` key `cauto_routes`
- Zones: `localStorage` key `cauto_zones`
- Punti: `localStorage` key `cauto_punti`

### Editor layout pattern (all 3 editors identical)
- Default: **list view** (cards with delete button)
- `+ Nuovo` button in top bar → switches to **form view**
- "Annulla" / "Chiudi" → back to list

### Empty defaults
```js
const EMPTY_ZONE_CFG = { type:"circle", name:"", comune:"", materiale:"", sector:"", fillColor:"#60a5fa", fillOpacity:0.3, borderColor:"#3a7bd5" };
const EMPTY_PUNTO_CFG = { nome:"", comune:"", materiale:"", sector:"", color:"#f87171" };
const EMPTY_META = { name:"", color:"#4ade80", opacity:0.85, comune:"", materiale:"", sector:"" };
```

### Map components
- `FleetMap` — renders vehicles, routes, zones, punti on Leaflet map
  - Props: `vehicles, routes, visibleRoutes, editMode, editWaypoints, editColor, zones, punti, onMapClick, onWaypointMove, onWaypointDelete, searchMarkerRef`
- `ZoneMap` — standalone map for zone drawing (multi-click)

---

## Backend — Key Notes

- All routes protected by `auth.js` middleware (JWT check)
- GPS data currently from mock adapter (`gps.mock.js`)
- Permissions stored server-side, loaded via `/api/permissions`
- Users allowed list in `data/users.js`

---

## Environment Variables

### Frontend (`cauto-frontend/.env`)
```
VITE_API_URL=https://<your-render-app>.onrender.com/api
VITE_AZURE_CLIENT_ID=<azure-app-client-id>
VITE_AZURE_TENANT_ID=<azure-tenant-id>
VITE_AZURE_REDIRECT_URI=https://argali.github.io/FleetCC/
```

### Backend (`cauto-backend/.env`)
```
PORT=3001
JWT_SECRET=<secret>
AZURE_CLIENT_ID=<azure-app-client-id>
AZURE_TENANT_ID=<azure-tenant-id>
```

---

## Deployment

```bash
# Frontend — build locally and push (CI handles deploy)
cd cauto-frontend && npm run build
git add src/App.jsx && git commit -m "feat: ..." && git push origin main
# GitHub Actions picks up push → builds → deploys to Pages

# Backend — auto-deploys on push via render.yaml
```

---

## Common Tasks

### Add a new user
Edit `cauto-backend/src/data/users.js`, add Azure email to the array.

### Change a color/style
Edit `const T = {...}` at top of `cauto-frontend/src/App.jsx`.

### Add a new route/sidebar module
1. Add key to sidebar nav array
2. Create `function XxxModule()` component
3. Add `{module==="xxx" && <XxxModule/>}` in main render
4. Add `/api/xxx` route in backend `src/routes/`

### Rebuild after changes
```bash
cd cauto-frontend && npm run build
```
