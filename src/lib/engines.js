// Deterministic, explainable engines (blueprint section 6).
// Every function returns its reasons so the UI can show why.
import { WEATHER_UNSAFE, MIN_HEALTH_TO_OPERATE, THRESHOLDS, SITE } from './config';

// ---------- 6.4 Task time prediction ----------
// Multipliers are fitted on the 100k-row task dataset by scripts/preprocess.py
export function predictMinutes(model, { type, est, weather = 'Sunny', skill = 'Intermediate', age = 5 }) {
  const base = est ?? model.baseEstimate[type] ?? 45;
  const mult = model.base * (model.weather[weather] ?? 1) * (model.skill[skill] ?? 1) * Math.pow(model.agePerYear, age);
  return Math.round(base * mult);
}

export function predictionFactors(model, { weather, skill, age }) {
  return [
    { label: `Weather: ${weather}`, pct: ((model.weather[weather] ?? 1) - 1) * 100 },
    { label: `Operator: ${skill}`, pct: ((model.skill[skill] ?? 1) - 1) * 100 },
    { label: `Machine age: ${age} yrs`, pct: (Math.pow(model.agePerYear, age) - 1) * 100 },
    { label: 'Baseline correction', pct: (model.base - 1) * 100 },
  ];
}

// ---------- 6.2 Collision risk ----------
// Risk = w1/(DCPA+1) + w2/(TCPA+1) + w3*BlindSpot + w4*Speed*Fvis*Fslope*Fground
export const RISK_W = { w1: 1.3, w2: 1.1, w3: 0.28, w4: 0.035 };
export function closestApproach(p1, v1, p2, v2) {
  const px = p2.x - p1.x, py = p2.y - p1.y;
  const vx = v2.x - v1.x, vy = v2.y - v1.y;
  const vv = vx * vx + vy * vy;
  let tcpa = vv < 1e-6 ? Infinity : -(px * vx + py * vy) / vv;
  if (tcpa < 0) tcpa = Infinity; // moving apart
  const t = Number.isFinite(tcpa) ? Math.min(tcpa, 10) : 0;
  const dcpa = Math.hypot(px + vx * t, py + vy * t);
  return { tcpa, dcpa, dist: Math.hypot(px, py) };
}
export function visibilityFactor(visKm) { return visKm >= 5 ? 1 : visKm >= 1 ? 1.25 : visKm >= 0.2 ? 1.6 : 2; }
export function groundFactor(condition) { return { Rainy: 1.35, Snowy: 1.5, Foggy: 1.1, Windy: 1.05 }[condition] ?? 1; }

export function collisionRisk({ dcpa, tcpa, blind, speed, vis = 1, slope = 1, ground = 1 }) {
  const { w1, w2, w3, w4 } = RISK_W;
  // time term only counts when the paths actually converge (closest approach under 8 m)
  const tTerm = Number.isFinite(tcpa) && tcpa <= 10 && dcpa < 8 ? w2 / (tcpa + 1) : 0;
  const r = w1 / (dcpa + 1) + tTerm + w3 * (blind ? 1 : 0) + w4 * speed * vis * slope * ground;
  return Math.min(1, r);
}
export function riskLevel(r) { return r >= 0.8 ? 'critical' : r >= 0.5 ? 'warning' : 'safe'; }

// Blind spot: rear 120° sector of the machine, or the swing side for excavators
export function inBlindSpot(machine, point) {
  const ang = Math.atan2(point.y - machine.y, point.x - machine.x);
  const diff = ((ang - machine.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI; // -π..π from the heading
  return Math.abs(diff) > (Math.PI * 2) / 3; // rear 120° sector
}

// ---------- 6.3 Machine health (live) ----------
export function liveHealth(baseHealth, t) {
  const reasons = [];
  let pen = 0;
  if (t.engineTemp >= THRESHOLDS.engineTemp.crit) { pen += 18; reasons.push('Engine over-temperature'); }
  else if (t.engineTemp >= THRESHOLDS.engineTemp.warn) { pen += 7; reasons.push('Engine running hot'); }
  if (t.hydraulic < THRESHOLDS.hydraulic.low) { pen += 14; reasons.push('Hydraulic pressure low'); }
  if (t.hydraulic > THRESHOLDS.hydraulic.high) { pen += 10; reasons.push('Hydraulic pressure high'); }
  if (t.oil < THRESHOLDS.oil.low) { pen += 15; reasons.push('Oil pressure low'); }
  if (t.fuelPct < THRESHOLDS.fuel.crit) { pen += 6; reasons.push('Fuel critical'); }
  if (t.battery < THRESHOLDS.battery.low) { pen += 5; reasons.push('Battery voltage low'); }
  if (t.drift) { pen += 8; reasons.push(`Hydraulic drift (z = ${t.drift.toFixed(1)})`); }
  return { score: Math.max(0, Math.round(baseHealth - pen)), reasons };
}

export function healthLabel(h) { return h >= 75 ? 'Good' : h >= 60 ? 'Watch' : h >= MIN_HEALTH_TO_OPERATE ? 'Service soon' : 'Do not operate'; }
export function healthTone(h) { return h >= 75 ? 'ok' : h >= 60 ? 'warn' : 'danger'; }

// Predictive maintenance: days until next service at the machine's recent usage
export function daysToService(m) {
  const hoursPerDay = Math.max(2, (m.sessions / 365) * 1.6);
  return Math.max(0, Math.round(m.serviceDueIn / hoursPerDay));
}

// ---------- Fatigue and heat stress ----------
export function fatigueScore({ hoursToday = 0, tempC = 30, humidity = 50, minsSinceBreak = 0 }) {
  const heatIndex = tempC + 0.1 * Math.max(0, humidity - 40) * (tempC > 26 ? 1 : 0.3);
  const s = Math.min(100, hoursToday * 6 + Math.max(0, heatIndex - 28) * 3.2 + Math.max(0, minsSinceBreak - 90) * 0.35);
  const level = s >= 70 ? 'High' : s >= 45 ? 'Elevated' : 'Normal';
  const advice = s >= 70 ? 'Take a 15-minute shaded break with water now.' : s >= 45 ? 'Plan a water break within 30 minutes.' : 'You are fine. Keep drinking water every hour.';
  return { score: Math.round(s), level, advice, heatIndex: Math.round(heatIndex) };
}

// ---------- 6.5 Re-planner ----------
export function planFinish(tasks, predictedOf) {
  // sequential per operator, starting now (or at shift start if earlier)
  const start = Math.max(Date.now(), new Date().setHours(SITE.shiftStart, 0, 0, 0));
  const perOp = {};
  tasks.filter((t) => t.status !== 'done').forEach((t) => { // paused work still has to be done later
    const remaining = t.status === 'in_progress' && t.startedAt ? Math.max(5, predictedOf(t) - (Date.now() - t.startedAt) / 60000) : predictedOf(t);
    perOp[t.operator] = (perOp[t.operator] ?? 0) + remaining;
  });
  const maxMin = Math.max(0, ...Object.values(perOp));
  return start + maxMin * 60000;
}

export function replan({ tasks, model, weather, prevWeather, opsById, machinesById, lowFuelMachines = [] }) {
  const todays = tasks.filter((t) => t.status !== 'done');
  const pOf = (w) => (t) => predictMinutes(model, { type: t.type, est: t.est, weather: w, skill: opsById[t.operator]?.skill, age: 2026 - (machinesById[t.machine]?.year ?? 2020) });
  const oldFinish = planFinish(todays, pOf(prevWeather));
  const unsafe = WEATHER_UNSAFE[weather] ?? [];
  const pause = todays.filter((t) => unsafe.includes(t.type) && t.status !== 'paused').map((t) => t.id);
  const resume = todays.filter((t) => t.status === 'paused' && !unsafe.includes(t.type)).map((t) => t.id);
  const after = todays.map((t) => ({ ...t, status: pause.includes(t.id) ? 'paused' : resume.includes(t.id) ? 'assigned' : t.status }));
  const HOLD = 60; // minutes paused work waits for the weather window to pass
  const newFinish = planFinish(after, pOf(weather)) + (pause.length ? HOLD * 60000 : 0);
  const reasons = [];
  if (weather !== prevWeather) {
    const pct = Math.round(((model.weather[weather] ?? 1) / (model.weather[prevWeather] ?? 1) - 1) * 100);
    reasons.push(`Weather changed ${prevWeather} to ${weather}: task times ${pct >= 0 ? '+' : ''}${pct}%`);
  }
  if (pause.length) reasons.push(`${pause.length} task${pause.length > 1 ? 's' : ''} paused: ${unsafe.join(', ')} unsafe in ${weather.toLowerCase()} conditions, resumes after a ${HOLD}-minute weather hold`);
  if (resume.length) reasons.push(`${resume.length} paused task${resume.length > 1 ? 's' : ''} resumed`);
  lowFuelMachines.forEach((m) => reasons.push(`${m} low on fuel: refuel stop inserted (+15 min)`));
  const predictions = after.map((t) => [t.id, pOf(weather)(t)]);
  return { oldFinish, newFinish: newFinish + lowFuelMachines.length * 15 * 60000, reasons, pause, resume, predictions, weather };
}

// ---------- Behaviour ----------
export function behaviourNotes(op, fleetAvg) {
  const out = [];
  if (op.unbeltedRate > 0.13) out.push('Seatbelt left unfastened more often than the fleet average');
  if (op.alertRate > fleetAvg.alertRate * 1.08) out.push('Safety alerts above fleet average');
  if (op.avgIdle > 28.5) out.push('Long idling per session: fuel and wear');
  if (!out.length) out.push('Consistent, safe operation');
  return out;
}

export const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const fmtDate = (ts) => new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'short' });
export const fmtAgo = (ts) => {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};
export const n = (x, d = 0) => Number(x).toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d });
