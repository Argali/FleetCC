# VisiRun Integration — Setup Guide

## Prerequisites

1. **API key** — already obtained from VisiRun helpdesk (`helpdesk@visirun.com`)
2. **IP allowlisting** — Render's outbound IP must be registered with VisiRun

---

## Step 1 — Find Render's outbound IP

VisiRun rejects all requests from non-registered IPs with error `100`.
You need to send Render's static outbound IP to VisiRun before the integration works.

1. Log in to [render.com](https://render.com) → select your backend service
2. Go to **Settings → Outbound IPs**
3. Copy all listed IPs (Render provides a small range, usually 2–4 addresses)

If Render shows no static IPs, your plan may not include them.  
Check: **Settings → Plan** — Static outbound IPs require a paid plan.

---

## Step 2 — Email VisiRun to register the IPs

Send an email to `helpdesk@visirun.com`:

```
Subject: IP allowlisting request — FleetCC integration

Hi,

We would like to register the following IP addresses to use with our API key:

  <paste Render outbound IPs here>

Company: <your company name>
API key: <your key>

Thank you.
```

Allowlisting typically takes 1–2 business days.

---

## Step 3 — Add environment variables on Render

In the Render dashboard, go to your backend service → **Environment**:

| Variable | Value |
|----------|-------|
| `GPS_PROVIDER` | `visirun` |
| `VISIRUN_API_KEY` | your key from VisiRun |

**Do not commit your API key to git.** It lives only in Render's environment.

---

## Step 4 — Deploy and verify

After saving the env vars, Render will automatically redeploy.

Verify with a quick curl (replace the token with a valid JWT):

```bash
curl https://fleetcc-backend.onrender.com/api/gps/vehicles \
  -H "Authorization: Bearer <your_token>"
```

Expected: `{ "ok": true, "data": [ { "id": "...", "name": "...", ... } ] }`

If you see `{ "ok": false, "error": "[VisiRun] SOAP fault..." }` or a 500 error,
check the Render logs for the raw VisiRun error message.

---

## Available endpoints (after activation)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/gps/vehicles` | Live positions of all fleet vehicles (cached 30 s) |
| GET | `/api/gps/history/:plate?date=yyyy-mm-dd` | Full-day GPS track for one vehicle |
| GET | `/api/gps/stops/:plate?start=...&end=...` | Stop list (max 7-day window, UTC timestamps) |
| GET | `/api/gps/kpi?date=yyyy-mm-dd` | Daily KPIs (distance, fuel, drive time) per vehicle |
| GET | `/api/gps/odometer` | Cumulative km + engine hours for all vehicles |

The `start`/`end` parameters for `/stops` use the format `yyyy-mm-dd hh:mm:ss` (UTC).

---

## Rate limits to be aware of

| Endpoint | Daily limit | Min interval |
|----------|-------------|--------------|
| `getFleetCurrentPosition` (vehicles) | 1 000 / day | 1 s |
| `getRoute` (history) | 1 000 / day | 1 s |
| `getStops` | 100 / vehicle | 5 min same vehicle |
| `getFleetKpi` | 1 000 / day | 1 s |
| `getFleetOdometer` | 1 000 / day | 1 s |

The vehicle positions endpoint is cached for **30 seconds** server-side, so the
frontend polling every 10 s makes at most ~2 880 SOAP calls per day — well within limits.

---

## Fallback

At any point you can revert to mock data without code changes:

```
GPS_PROVIDER=mock   ← set this in Render environment
```

The mock adapter returns in-memory demo vehicles. All other endpoints still work.
