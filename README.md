# SiteSense web dashboard

Safety and productivity dashboard for Caterpillar job sites, built from the SiteSense architecture blueprint. One web app, two role-based dashboards (operator/worker and supervisor) that share one live state, so anything the supervisor assigns appears on the operator's screen within a second, and anything the operator reports appears on the supervisor's.

## Run it

Requirements: Node.js 18 or newer (https://nodejs.org). Python is only needed if you change the CSV data.

```bash
npm install
npm run dev
```

The browser opens at http://localhost:5173.

To see the two dashboards talk to each other, open two tabs:

1. Tab 1: sign in as **Operator or worker**. Pick any operator ID and type a machine ID such as `EXC001`, `DOZ014`, `GRD007` or `LOD003`.
2. Tab 2: sign in as **Supervisor** with ID `SUP-01` and PIN `1234`.

Each tab keeps its own login, and both share the same site state. Assign a task, reply to an issue, press SOS, change the weather: the other tab updates live.

Other commands: `npm run build` (production build to `dist/`), `npm run preview` (serve the build), `npm run data` (rebuild the JSON from the CSVs; needs `pip install -r requirements.txt`).

## What is inside

### Operator / worker dashboard (signs in with a machine ID)
- **Today**: the machine's data plate with live health score, pre-shift PPE check that gates the shift start, clock in and out with breaks, eight live telemetry signals (engine temp, hydraulic pressure, oil pressure, fuel, battery, rpm, load, speed) with a live chart, rule and z-score anomaly alerts, a morning briefing in English, Hindi or Tamil that can be read aloud, next tasks, and supervisor messages. A "simulate a fault" menu injects a hydraulic leak, overheating and more for demos.
- **Machine history**: everything that machine did across the year from the telemetry CSV: sessions, load cycles, fuel, idling, weekly output vs fuel chart, monthly safety alerts, an explained health score, planned vs actual on recent jobs, who ran it and the latest sessions.
- **My tasks**: tasks from the supervisor with start, done and "can't do" (which raises an issue), predicted time for today's conditions, plan-change notices, and the work left on the machine.
- **Safety**: cab proximity radar using the blueprint's collision risk formula, the operator's own safety record against the site average, fatigue and heat-stress score, PPE history.
- **Issues and hours**: report faults, hazards, near misses or complaints and see supervisor replies; hours this week against the 48 h limit.
- **Learn**: official Cat Products YouTube videos and playlists, an animated lesson per course (swing radius, blind spot, walkaround, hydraulics, SOS, weather), key points, and a 5-question quiz with XP, badges and streaks. Recommendations come from the person's own record and machine.
- **SOS**: press and hold for 2 seconds. Captures location and machine state, alerts the supervisor, shows the right procedure.
- **Copilot**: ask by text or voice (Chrome or Edge) about tasks, fuel, health, weather, or procedures.

### Supervisor dashboard
- **Command center**: live site map with zones, machines, swing radii and ground crew, live geofence and collision alerts, what-if weather that re-plans the day with reasons, crew on shift, event feed, SOS alarm banner with acknowledge and resolve.
- **Tasks and plan**: assign tasks with checks (machine can do the task, machine health, weather safety) and a predicted time explained factor by factor; live task board.
- **Issues and SOS**: complaints inbox with replies, SOS timelines, emergency drills with muster check-in times, and a SHA-256 hash-chained audit trail that verifies itself.
- **Fleet**: trends by machine type, the seatbelt effect, alerts by hour, health bands, idle cost ledger (fuel, rupees, CO2), predictive maintenance queue, and a searchable machine table.
- **Crew**: hours worked, behaviour scores, coaching notes, and one-click training assignment.
- **Planning insights**: the task time model trained on the 100,000-task CSV. Planned times on this data run about 20% short; the model cuts the average error from 12.1 to 3.1 minutes (74% better).
- **Broadcast**: messages and an auto-drafted toolbox talk built from today's weather, alerts and open issues.

## Findings from the provided data
- 92% of sessions with an unfastened seatbelt triggered a safety alert, against 2% when fastened. 86% of all alerts come from unbelted sessions. A seatbelt interlock is the single biggest safety lever.
- The fleet idled for about 45,600 hours in the year. At 3.2 L/h that is about 146,000 L of diesel, around ₹1.3 crore and 390 t of CO2.
- Tasks overrun plans by about 21% on average: +25% in rain, +38% in snow, +36% for beginners, and about 1.1% more per year of machine age.

## How it maps to the blueprint

| Blueprint | Where it lives |
| --- | --- |
| Site Simulator (live machine, worker, weather data) | `src/lib/sim.js` |
| Event bus with typed events `{type, site_id, ts, source, payload}` | `src/lib/store.js` |
| Geofence engine, collision risk formula (6.1, 6.2) | `src/lib/sim.js`, `src/lib/engines.js` |
| Machine health and behaviour (6.3) | `scripts/preprocess.py`, `src/lib/engines.js` |
| Task time prediction (6.4) | `scripts/preprocess.py` fits multipliers; `predictMinutes` |
| Scheduler constraints and re-planner (6.5) | `replan` in `src/lib/engines.js` |
| LLM copilot with offline fallback (6.6) | `src/lib/copilot.js` |
| SOS workflow (7) | `actions.raiseSOS` and the SOS screens |
| Learning hub (M11), gamification (M12) | `src/lib/courses.js`, `src/components/LearningHub.jsx` |
| Innovations: fatigue score, cab radar, toolbox talk generator, multilingual voice briefing, hash-chained audit trail, predictive maintenance, carbon and fuel dashboard | across the pages above |

Weather comes live from Open-Meteo (no key needed) and falls back to the last known values when offline. Change the site location in `src/lib/config.js`.

### Moving to a real backend
All writes go through `commit()` in `src/lib/store.js`. Today it persists to the browser and syncs tabs through the `storage` event. To go multi-device, replace `persist` and the `storage` listener with Supabase Realtime or Socket.IO; the action functions and screens stay the same. To use an LLM for the copilot, send the same context object `answer()` receives to your model and keep `answer()` as the fallback.

## Project layout

```
data/                 original CSV datasets
scripts/preprocess.py CSV -> JSON (per machine, per operator, fleet, task model)
public/data/          generated JSON the app loads
src/lib/              config, store (event bus), simulator, engines, copilot, courses
src/components/       shell, charts helpers, site map, radar, learning hub, animations
src/pages/            Login, Operator, Supervisor, SupervisorInsights
```

To clear demo data, use "Reset demo data" on the supervisor's Broadcast page.
