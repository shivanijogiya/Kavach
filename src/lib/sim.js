// Site Simulator (blueprint: "a Site Simulator service generates live machine,
// weather, worker and site data"). Runs in the browser at 1 Hz and is seeded
// per machine so each machine behaves the same way on every run.
import { useEffect, useRef, useState } from 'react';
import { closestApproach, collisionRisk, inBlindSpot, riskLevel, visibilityFactor, groundFactor } from './engines';
import { TYPE_META, THRESHOLDS, SITE } from './config';
import { actions, getState } from './store';

export function hashStr(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rng(seed) { let s = seed || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

export function useTick(ms = 1000) {
  const [t, setT] = useState(0);
  useEffect(() => { const i = setInterval(() => setT((x) => x + 1), ms); return () => clearInterval(i); }, [ms]);
  return t;
}

// ---------------- machine telemetry (8 signals) ----------------
function initTelemetry(m) {
  const r = rng(hashStr(m.id));
  return {
    t: 0, mode: 'idle', engineTemp: 64, hydraulic: 318, oil: 330, rpm: 850, load: 6, speed: 0,
    fuelPct: Math.round(22 + r() * 60), battery: 27.4, cyclesToday: 0, idleSec: 0, workSec: 0,
    anomalyAt: m.health < 64 ? 45 + Math.round(r() * 30) : null, history: [], drift: 0,
  };
}

export function useMachineTelemetry(machine, { working, weather }) {
  const workingRef = useRef(working); workingRef.current = working;
  const weatherRef = useRef(weather); weatherRef.current = weather;
  const [tel, setTel] = useState(() => initTelemetry(machine));
  const injectRef = useRef(null);
  useEffect(() => {
    const r = rng(hashStr(machine.id) ^ 0x9e3779b9);
    let s = initTelemetry(machine);
    setTel(s);
    const id = setInterval(() => {
      const w = weatherRef.current ?? {};
      const mode = workingRef.current ? (Math.sin(s.t / 23) > -0.55 ? 'working' : 'idle') : 'idle';
      const n = (a) => (r() - 0.5) * a;
      const load = mode === 'working' ? Math.max(15, Math.min(98, 58 + 28 * Math.sin(s.t / 6) + n(14))) : 5 + n(3);
      const ambient = w.temp ?? 30;
      const targetTemp = 78 + load * 0.16 + (ambient - 30) * 0.35;
      let engineTemp = s.engineTemp + (targetTemp - s.engineTemp) * 0.08 + n(0.6);
      let hydraulic = 300 + load * 0.45 + n(6);
      let oil = 280 + load * 0.9 + n(8);
      const inj = injectRef.current;
      if (s.anomalyAt && s.t > s.anomalyAt) hydraulic -= Math.min(55, (s.t - s.anomalyAt) * 0.9);
      if (inj === 'hydraulic') hydraulic -= Math.min(70, (s.t - (s.injectAt ?? s.t)) * 3);
      if (inj === 'overheat') engineTemp = Math.min(112, s.engineTemp + 0.9);
      if (inj === 'oil') oil = Math.max(150, s.oil - 6);
      const fuelBurn = mode === 'working' ? 0.035 + load * 0.0004 : 0.012;
      let fuelPct = Math.max(0, s.fuelPct - fuelBurn - (inj === 'fuel' ? 0.6 : 0));
      const history = [...s.history, { t: s.t, engineTemp: +engineTemp.toFixed(1), hydraulic: Math.round(hydraulic), oil: Math.round(oil), load: Math.round(load), fuelPct: +fuelPct.toFixed(1) }].slice(-90);
      // rolling z-score drift detection on hydraulic pressure
      let drift = 0;
      if (history.length > 40) {
        const base = history.slice(0, -10).map((h) => h.hydraulic);
        const mean = base.reduce((a, b) => a + b, 0) / base.length;
        const sd = Math.sqrt(base.reduce((a, b) => a + (b - mean) ** 2, 0) / base.length) || 1;
        const recent = history.slice(-10).reduce((a, h) => a + h.hydraulic, 0) / 10;
        const z = (recent - mean) / sd;
        if (z < -2.2) drift = z;
      }
      const cycle = mode === 'working' && s.t % 22 === 0 && s.t > 0;
      s = {
        ...s, t: s.t + 1, mode, load, engineTemp, hydraulic, oil, fuelPct,
        rpm: mode === 'working' ? 1450 + load * 4.5 + n(40) : 820 + n(20),
        speed: mode === 'working' ? Math.max(0, 3 + 3 * Math.sin(s.t / 4) + n(1)) : 0,
        battery: 27.2 + n(0.3) - (inj === 'battery' ? 3.6 : 0),
        cyclesToday: s.cyclesToday + (cycle ? 1 : 0),
        idleSec: s.idleSec + (mode === 'idle' && workingRef.current ? 1 : 0),
        workSec: s.workSec + (mode === 'working' ? 1 : 0),
        history, drift,
      };
      setTel(s);
    }, 1000);
    const api = { inject: (kind) => { injectRef.current = kind; s = { ...s, injectAt: s.t }; }, clear: () => { injectRef.current = null; } };
    injectRef.api = api;
    return () => clearInterval(id);
  }, [machine.id]);
  return { tel, inject: (k) => injectRef.api?.inject(k), clear: () => injectRef.api?.clear() };
}

export function telemetryAlerts(t) {
  const a = [];
  if (t.engineTemp >= THRESHOLDS.engineTemp.crit) a.push({ sev: 'critical', text: `Engine at ${t.engineTemp.toFixed(0)}°C. Stop and let it cool at idle.` });
  else if (t.engineTemp >= THRESHOLDS.engineTemp.warn) a.push({ sev: 'warning', text: `Engine running hot (${t.engineTemp.toFixed(0)}°C). Check coolant and radiator screen.` });
  if (t.hydraulic < THRESHOLDS.hydraulic.low) a.push({ sev: 'critical', text: `Hydraulic pressure low (${t.hydraulic.toFixed(0)} bar). Possible leak. Lower the bucket and inspect.` });
  else if (t.drift) a.push({ sev: 'warning', text: `Hydraulic pressure drifting down (z = ${t.drift.toFixed(1)}). Early sign of a leak or pump wear.` });
  if (t.oil < THRESHOLDS.oil.low) a.push({ sev: 'critical', text: `Oil pressure low (${t.oil.toFixed(0)} kPa). Shut down the engine.` });
  if (t.fuelPct < THRESHOLDS.fuel.crit) a.push({ sev: 'critical', text: `Fuel at ${t.fuelPct.toFixed(0)}%. Head to the fuel bay now.` });
  else if (t.fuelPct < THRESHOLDS.fuel.low) a.push({ sev: 'warning', text: `Fuel at ${t.fuelPct.toFixed(0)}%. Plan a refuel before your next task.` });
  if (t.battery < THRESHOLDS.battery.low) a.push({ sev: 'warning', text: `Battery at ${t.battery.toFixed(1)} V. Check the alternator belt.` });
  return a;
}

// ---------------- operator cab radar ----------------
export function useCabRadar(machine, { working, weather }) {
  const workingRef = useRef(working); workingRef.current = working;
  const weatherRef = useRef(weather); weatherRef.current = weather;
  const [state, setState] = useState({ workers: [], machine: { x: 0, y: 0, heading: -Math.PI / 2, speed: 0, reversing: false }, top: null });
  const forceRef = useRef(false);
  useEffect(() => {
    const r = rng(hashStr(machine.id) ^ 0x51ed);
    const names = ['Ground crew 1', 'Ground crew 2', 'Banksman', 'Surveyor', 'Pipe fitter'];
    let workers = names.map((name, i) => { const a = (i / names.length) * 6.283, d = 14 + r() * 20; return { id: `W${i + 1}`, name, x: Math.cos(a) * d, y: Math.sin(a) * d, vx: 0, vy: 0 }; });
    let t = 0;
    const id = setInterval(() => {
      t += 1;
      const w = weatherRef.current ?? {};
      const reversing = workingRef.current && Math.sin(t / 9) < -0.6;
      const speed = workingRef.current ? (reversing ? 1.6 : 1.2) : 0;
      const heading = -Math.PI / 2 + Math.sin(t / 15) * 0.6;
      const m = { x: 0, y: 0, heading, speed, reversing, vx: Math.cos(heading) * speed * (reversing ? -1 : 1), vy: Math.sin(heading) * speed * (reversing ? -1 : 1) };
      workers = workers.map((wk, i) => {
        let tx = wk.tx, ty = wk.ty;
        if (tx === undefined || Math.hypot(tx - wk.x, ty - wk.y) < 2 || r() < 0.02) { const a = r() * 6.283, d = 10 + r() * 26; tx = Math.cos(a) * d; ty = Math.sin(a) * d; }
        if (forceRef.current && i === 0) { tx = -Math.cos(heading) * 5; ty = -Math.sin(heading) * 5; }
        const d = Math.hypot(tx - wk.x, ty - wk.y) || 1;
        const sp = forceRef.current && i === 0 ? 2 : 0.8;
        const vx = ((tx - wk.x) / d) * sp, vy = ((ty - wk.y) / d) * sp;
        return { ...wk, tx, ty, vx, vy, x: wk.x + vx, y: wk.y + vy };
      });
      const scored = workers.map((wk) => {
        const ca = closestApproach(m, { x: m.vx, y: m.vy }, wk, { x: wk.vx, y: wk.vy });
        const blind = inBlindSpot(m, wk) && ca.dist < 18;
        const risk = ca.dist > 40 ? 0.02 : collisionRisk({ dcpa: ca.dcpa, tcpa: ca.tcpa, blind, speed: m.speed + 1.2, vis: visibilityFactor(w.visibility ?? 10), ground: groundFactor(w.condition) });
        const reasons = [];
        if (m.reversing) reasons.push('machine reversing');
        if (blind) reasons.push('worker in blind spot');
        if (Number.isFinite(ca.tcpa) && ca.tcpa < 10 && ca.dcpa < 8) reasons.push(`${ca.tcpa.toFixed(0)} s to closest approach`);
        reasons.push(`${ca.dist.toFixed(0)} m away`);
        return { ...wk, risk, level: riskLevel(risk), reasons, dist: ca.dist, blind };
      });
      const top = [...scored].sort((a, b) => b.risk - a.risk)[0];
      setState({ workers: scored, machine: m, top });
    }, 1000);
    return () => clearInterval(id);
  }, [machine.id]);
  return { ...state, forceHazard: (on) => { forceRef.current = on; } };
}

// ---------------- whole-site simulation for the command center ----------------
export const SITE_W = 440, SITE_H = 280;
export const SITE_ZONES = [
  { id: 'A', name: 'Zone A (north cut)', type: 'danger', x: 30, y: 24, w: 140, h: 86 },
  { id: 'B', name: 'Zone B (trench line)', type: 'danger', x: 200, y: 36, w: 210, h: 34 },
  { id: 'D', name: 'Zone D (haul road)', type: 'warning', x: 12, y: 126, w: 416, h: 22 },
  { id: 'C', name: 'Zone C (stockpile)', type: 'warning', x: 250, y: 162, w: 110, h: 76 },
  { id: 'E', name: 'Zone E (fill area)', type: 'safe', x: 30, y: 164, w: 170, h: 80 },
  { id: 'X', name: 'Exclusion: overhead line', short: 'No-go', type: 'critical', x: 380, y: 160, w: 44, h: 100 },
];
export const MUSTER = { x: 225, y: 262, name: 'Muster point' };
const inRect = (p, z) => p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h;
const distToRect = (p, z) => Math.hypot(Math.max(z.x - p.x, 0, p.x - (z.x + z.w)), Math.max(z.y - p.y, 0, p.y - (z.y + z.h)));

export function geofence(p, machines) {
  let zone = { type: 'safe', name: 'Open ground' };
  for (const z of SITE_ZONES) if (inRect(p, z)) { zone = z; break; }
  for (const m of machines) {
    if (m.working && Math.hypot(m.x - p.x, m.y - p.y) < TYPE_META[m.type].swing) return { type: 'danger', name: `${m.id} swing radius` };
  }
  if (zone.type === 'critical') return zone;
  if (zone.type !== 'danger' && SITE_ZONES.some((z) => z.type === 'danger' && distToRect(p, z) < 10)) return { type: 'warning', name: 'Within 10 m of a danger zone' };
  return zone;
}

export function useSiteSim(machines, operators, weather) {
  const weatherRef = useRef(weather); weatherRef.current = weather;
  const hazardRef = useRef(false);
  const [snap, setSnap] = useState({ machines: [], workers: [], alerts: [], risks: [] });
  const key = machines.map((m) => m.id).join(',');
  useEffect(() => {
    if (!machines.length) return undefined;
    const r = rng(20260923);
    const zoneFor = { EXC: ['A', 'B'], DOZ: ['E', 'A'], GRD: ['D', 'E'], LOD: ['C', 'D'] };
    let ms = machines.map((m, i) => {
      const z = SITE_ZONES.find((q) => q.id === zoneFor[m.type][i % 2]);
      return { id: m.id, type: m.type, x: z.x + z.w * (0.2 + r() * 0.6), y: z.y + z.h * (0.2 + r() * 0.6), zone: z, heading: r() * 6.28, speed: 0, working: r() > 0.15, phase: r() * 10 };
    });
    let ws = operators.slice(0, 14).map((o, i) => ({ id: `GW-${String(i + 1).padStart(2, '0')}`, name: o.name, x: 30 + r() * 380, y: 30 + r() * 220 }));
    let alerts = [];
    let t = 0;
    const id = setInterval(() => {
      t += 1;
      const w = weatherRef.current ?? {};
      ms = ms.map((m) => {
        if (!m.working) return { ...m, speed: 0, vx: 0, vy: 0 };
        const turn = Math.sin((t + m.phase * 10) / 7) * 0.25;
        let heading = m.heading + turn * 0.3;
        const reversing = Math.sin((t + m.phase * 13) / 11) < -0.65;
        const speed = 1.3;
        let vx = Math.cos(heading) * speed * (reversing ? -1 : 1), vy = Math.sin(heading) * speed * (reversing ? -1 : 1);
        let x = m.x + vx, y = m.y + vy;
        const z = m.zone;
        if (x < z.x + 4 || x > z.x + z.w - 4 || y < z.y + 4 || y > z.y + z.h - 4) { heading += Math.PI * 0.8; x = m.x; y = m.y; vx = 0; vy = 0; }
        return { ...m, x, y, heading, speed, reversing, vx, vy };
      });
      ws = ws.map((wk, i) => {
        let { tx, ty } = wk;
        if (tx === undefined || Math.hypot(tx - wk.x, ty - wk.y) < 3 || r() < 0.01) { tx = 20 + r() * 400; ty = 20 + r() * 240; }
        if (hazardRef.current && i === 0) { const m = ms.find((q) => q.type === 'EXC' && q.working) ?? ms[0]; tx = m.x - Math.cos(m.heading) * 6; ty = m.y - Math.sin(m.heading) * 6; }
        const d = Math.hypot(tx - wk.x, ty - wk.y) || 1;
        const sp = hazardRef.current && i === 0 ? 2.2 : 1.1;
        const vx = ((tx - wk.x) / d) * sp, vy = ((ty - wk.y) / d) * sp;
        return { ...wk, tx, ty, vx, vy, x: wk.x + vx, y: wk.y + vy };
      });
      const risks = [];
      ws = ws.map((wk) => {
        const zone = geofence(wk, ms);
        let best = { risk: 0 };
        for (const m of ms) {
          const ca = closestApproach(m, { x: m.vx ?? 0, y: m.vy ?? 0 }, wk, { x: wk.vx, y: wk.vy });
          if (ca.dist > 40 || !m.working) continue;
          const blind = inBlindSpot(m, wk) && ca.dist < 15;
          const risk = collisionRisk({ dcpa: ca.dcpa, tcpa: ca.tcpa, blind, speed: m.speed + 1.1, vis: visibilityFactor(w.visibility ?? 10), ground: groundFactor(w.condition) });
          if (risk > best.risk) {
            const reasons = [];
            if (m.reversing) reasons.push('reversing');
            if (blind) reasons.push('worker in blind spot');
            if (Number.isFinite(ca.tcpa) && ca.tcpa < 10 && ca.dcpa < 8) reasons.push(`${ca.tcpa.toFixed(0)} s to contact`);
            if (!reasons.length) reasons.push(`${ca.dist.toFixed(0)} m apart`);
            best = { risk, machine: m.id, reasons };
          }
        }
        if (best.risk >= 0.5) risks.push({ worker: wk.id, name: wk.name, ...best, level: riskLevel(best.risk) });
        return { ...wk, zone, risk: best.risk };
      });
      const newAlerts = [];
      risks.filter((x) => x.level === 'critical').forEach((x) => newAlerts.push({ id: `${t}-${x.worker}`, ts: Date.now(), sev: 'critical', kind: 'risk.collision', text: `${x.worker} and ${x.machine}: ${x.reasons.slice(0, 2).join(', ')}` }));
      ws.filter((wk) => wk.zone.type === 'critical').forEach((wk) => newAlerts.push({ id: `${t}-${wk.id}-z`, ts: Date.now(), sev: 'critical', kind: 'zone.breach', text: `${wk.id} inside ${wk.zone.name}` }));
      if (t % 3 === 0) ws.filter((wk) => wk.zone.type === 'danger').slice(0, 1).forEach((wk) => newAlerts.push({ id: `${t}-${wk.id}-d`, ts: Date.now(), sev: 'warning', kind: 'zone.breach', text: `${wk.id} in ${wk.zone.name}` }));
      // de-duplicate: same text within 8 s
      const fresh = newAlerts.filter((a) => !alerts.some((b) => b.text === a.text && a.ts - b.ts < 8000));
      alerts = [...fresh, ...alerts].slice(0, 40);
      setSnap({ machines: ms, workers: ws, alerts, risks });
    }, 1000);
    return () => clearInterval(id);
  }, [key]);
  return { ...snap, triggerHazard: (on) => { hazardRef.current = on; } };
}

// ---------------- live weather (Open-Meteo, no key needed) ----------------
function codeToCondition(code, wind) {
  if ([45, 48].includes(code)) return 'Foggy';
  if ((code >= 71 && code <= 77) || [85, 86].includes(code)) return 'Snowy';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return 'Rainy';
  if (wind >= 30) return 'Windy';
  if (code >= 2) return 'Cloudy';
  return 'Sunny';
}
export function useLiveWeather(enabled, source) {
  useEffect(() => {
    if (!enabled) return undefined;
    const pull = async () => {
      const cur = getState().weather;
      if (cur.source === 'what-if') return; // supervisor override wins
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${SITE.lat}&longitude=${SITE.lng}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&hourly=visibility&forecast_days=1`;
        const j = await (await fetch(url)).json();
        const c = j.current;
        const hr = new Date().getHours();
        const vis = j.hourly?.visibility?.[hr];
        const condition = codeToCondition(c.weather_code, c.wind_speed_10m);
        actions.setWeather({ condition, temp: Math.round(c.temperature_2m), humidity: c.relative_humidity_2m, wind: Math.round(c.wind_speed_10m), rain: c.precipitation, visibility: vis ? +(vis / 1000).toFixed(1) : 10 }, 'live');
      } catch { /* offline: keep the last known weather */ }
    };
    const last = getState().weather;
    if (last.source === 'default' || (last.source === 'live' && Date.now() - last.updatedAt > 10 * 60000)) pull();
    const id = setInterval(pull, 10 * 60000);
    return () => clearInterval(id);
  }, [enabled, source]);
}
