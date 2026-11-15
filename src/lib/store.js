// Shared site state + typed event bus (blueprint section 5).
//
// Every write goes through `commit`, which appends a typed event
// ({ type, site_id, ts, source, payload }) and persists the whole state to
// localStorage. Other browser tabs receive the change through the `storage`
// event, so a supervisor tab and an operator tab stay in sync in real time.
// To move to a real backend, replace `persist`/`subscribe` with Socket.IO or
// Supabase Realtime; the action functions below stay the same.
import { useEffect, useState } from 'react';
import { SITE } from './config';
import { sha256 } from './sha256';

const KEY = 'sitesense.site.v2';
const listeners = new Set();
const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
const todayAt = (h, m = 0) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.getTime(); };
const AUDITED = new Set(['sos.raised', 'sos.updated', 'issue.raised', 'issue.updated', 'ppe.violation', 'task.assigned', 'plan.updated', 'drill.started']);

function seed() {
  const s = {
    version: 2,
    tasks: [], issues: [], sos: [], timesheets: [], broadcasts: [], ppe: [], training: [],
    gamification: {}, events: [], audit: [], replans: [],
    weather: { condition: 'Sunny', temp: 31, humidity: 58, wind: 9, rain: 0, visibility: 10, source: 'default', updatedAt: Date.now() },
  };
  const day = 86400000;
  const crew = [
    ['OP1001', 'EXC001'], ['OP1002', 'DOZ002'], ['OP1003', 'LOD003'], ['OP1004', 'GRD004'], ['OP1005', 'EXC005'],
    ['OP1006', 'LOD006'], ['OP1007', 'EXC007'], ['OP1008', 'DOZ008'], ['OP1009', 'GRD009'], ['OP1010', 'EXC010'],
  ];
  // past six days of timesheets
  for (let d = 6; d >= 1; d--) {
    crew.forEach(([op, m], i) => {
      if ((i + d) % 6 === 0) return; // day off
      const start = todayAt(7, 40 + ((i * 7 + d * 3) % 35)) - d * day;
      const hrs = 7.5 + (((i + 1) * (d + 2)) % 30) / 10;
      s.timesheets.push({ id: uid('TS'), operator: op, machine: m, in: start, out: start + hrs * 3600000, breaks: 45 });
    });
  }
  const mk = (op, m, type, zone, priority, est, status, extra = {}) => ({
    id: uid('TK'), operator: op, machine: m, type, zone, priority, est, predicted: Math.round(est * 1.18),
    status, createdBy: 'SUP-01', createdAt: todayAt(7, 30), notes: '', ...extra,
  });
  s.tasks.push(
    mk('OP1001', 'EXC001', 'Trenching', 'Zone B (trench line)', 'High', 55, 'in_progress', { startedAt: todayAt(8, 20), notes: 'Keep 1.5 m clear of the marked gas line at chainage 120.' }),
    mk('OP1001', 'EXC001', 'Earth Excavation', 'Zone A (north cut)', 'Medium', 65, 'assigned'),
    mk('OP1002', 'DOZ002', 'Site Clearing', 'Zone E (fill area)', 'Medium', 70, 'assigned'),
    mk('OP1003', 'LOD003', 'Material Loading', 'Zone C (stockpile)', 'High', 35, 'done', { startedAt: todayAt(8, 5), doneAt: todayAt(8, 48) }),
    mk('OP1003', 'LOD003', 'Hauling', 'Zone D (haul road)', 'Low', 30, 'assigned'),
    mk('OP1005', 'EXC005', 'Demolition', 'Zone A (north cut)', 'High', 100, 'assigned'),
  );
  s.issues.push(
    { id: uid('IS'), operator: 'OP1004', machine: 'GRD004', category: 'Machine fault', severity: 'Medium', text: 'Blade tilt responds slowly on the left side after warm-up.', status: 'open', ts: Date.now() - 3 * 3600000, replies: [] },
    { id: uid('IS'), operator: 'OP1006', machine: 'LOD006', category: 'Site hazard', severity: 'High', text: 'Loose soil at the stockpile edge near Zone C ramp.', status: 'acknowledged', ts: Date.now() - 26 * 3600000, replies: [{ by: 'SUP-01', text: 'Barricade placed. Use the east ramp until regraded.', ts: Date.now() - 25 * 3600000 }] },
  );
  s.broadcasts.push({ id: uid('BC'), kind: 'Toolbox talk', text: 'Morning toolbox talk: most alerts on this site come from unfastened seatbelts. Buckle up before the engine starts, every time.', ts: todayAt(7, 30), by: 'SUP-01' });
  s.gamification = {
    OP1001: { xp: 420, streak: 6, badges: ['Smooth Operator'], quizzes: {} },
    OP1003: { xp: 610, streak: 11, badges: ['Zero Breach Week', 'Storm Ready'], quizzes: {} },
  };
  return s;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const s = JSON.parse(raw); if (s.version === 2) return s; }
  } catch { /* fall through to seed */ }
  const s = seed();
  localStorage.setItem(KEY, JSON.stringify(s));
  return s;
}

let state = load();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota full: keep in memory */ }
  listeners.forEach((l) => l(state));
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY && e.newValue) { state = JSON.parse(e.newValue); listeners.forEach((l) => l(state)); }
  });
}

export function getState() { return state; }

export function useSite() {
  const [s, set] = useState(state);
  useEffect(() => { listeners.add(set); set(state); return () => listeners.delete(set); }, []);
  return s;
}

function commit(type, source, payload, mutate) {
  const next = structuredClone(state);
  mutate?.(next);
  const ev = { id: uid('EV'), type, site_id: SITE.id, ts: Date.now(), source, payload };
  next.events = [ev, ...next.events].slice(0, 300);
  if (AUDITED.has(type)) {
    const prev = next.audit[0]?.hash ?? '0'.repeat(64);
    const body = JSON.stringify({ type, ts: ev.ts, source, payload });
    next.audit = [{ i: (next.audit[0]?.i ?? 0) + 1, ts: ev.ts, type, source, body, prev, hash: sha256(prev + body) }, ...next.audit].slice(0, 500);
  }
  state = next;
  persist();
  return ev;
}

export function verifyAudit(audit) {
  const chain = [...audit].reverse();
  for (let i = 0; i < chain.length; i++) {
    const expectedPrev = i === 0 ? chain[0].prev : chain[i - 1].hash;
    if (chain[i].prev !== expectedPrev || sha256(chain[i].prev + chain[i].body) !== chain[i].hash) return { ok: false, brokenAt: chain[i].i };
  }
  return { ok: true, length: chain.length };
}

export function resetDemo() { state = seed(); persist(); }

// ---------------- actions ----------------
export const actions = {
  assignTask(t, by = 'SUP-01') {
    const task = { id: uid('TK'), status: 'assigned', createdBy: by, createdAt: Date.now(), notes: '', ...t };
    commit('task.assigned', by, { id: task.id, operator: t.operator, machine: t.machine, type: t.type }, (s) => { s.tasks.unshift(task); });
    return task;
  },
  setTaskStatus(id, status, by, note) {
    commit('task.updated', by, { id, status }, (s) => {
      const t = s.tasks.find((x) => x.id === id); if (!t) return;
      t.status = status;
      if (status === 'in_progress' && !t.startedAt) t.startedAt = Date.now();
      if (status === 'done') t.doneAt = Date.now();
      if (note) t.notes = t.notes ? `${t.notes}\n${note}` : note;
    });
  },
  raiseIssue(i) {
    const issue = { id: uid('IS'), status: 'open', ts: Date.now(), replies: [], ...i };
    commit('issue.raised', i.operator, { id: issue.id, category: i.category, severity: i.severity, machine: i.machine }, (s) => { s.issues.unshift(issue); });
  },
  respondIssue(id, status, text, by = 'SUP-01') {
    commit('issue.updated', by, { id, status }, (s) => {
      const i = s.issues.find((x) => x.id === id); if (!i) return;
      i.status = status;
      if (text) i.replies.push({ by, text, ts: Date.now() });
    });
  },
  raiseSOS(p) {
    const sos = { id: uid('SOS'), status: 'active', ts: Date.now(), timeline: [{ ts: Date.now(), text: `SOS raised: ${p.type}` }], ...p };
    sos.timeline.push({ ts: Date.now(), text: `Machine state captured: ${p.machineState ?? 'n/a'}` });
    sos.timeline.push({ ts: Date.now(), text: 'Stop signal sent to machines within 30 m (simulated interlock)' });
    commit('sos.raised', p.operator, { id: sos.id, type: p.type, machine: p.machine, drill: !!p.drill }, (s) => { s.sos.unshift(sos); });
    return sos;
  },
  updateSOS(id, status, text, by = 'SUP-01', patch = {}) {
    commit('sos.updated', by, { id, status, ...patch }, (s) => {
      const x = s.sos.find((y) => y.id === id); if (!x) return;
      Object.assign(x, patch);
      x.status = status;
      x.timeline.push({ ts: Date.now(), text: text || `Status changed to ${status}` });
      if (status === 'resolved') x.resolvedAt = Date.now();
      if (status === 'acknowledged') x.ackAt = Date.now();
    });
  },
  clockIn(operator, machine) {
    commit('shift.started', operator, { operator, machine }, (s) => {
      if (s.timesheets.some((t) => t.operator === operator && !t.out)) return;
      s.timesheets.push({ id: uid('TS'), operator, machine, in: Date.now(), out: null, breaks: 0 });
    });
  },
  clockOut(operator) {
    commit('shift.ended', operator, { operator }, (s) => {
      const t = s.timesheets.find((x) => x.operator === operator && !x.out); if (t) t.out = Date.now();
    });
  },
  logBreak(operator, minutes) {
    commit('shift.break', operator, { operator, minutes }, (s) => {
      const t = s.timesheets.find((x) => x.operator === operator && !x.out); if (t) { t.breaks += minutes; t.lastBreak = Date.now(); }
    });
  },
  submitPPE(operator, machine, checks) {
    const missing = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    commit(missing.length ? 'ppe.violation' : 'ppe.check', operator, { operator, machine, missing }, (s) => {
      s.ppe.unshift({ id: uid('PPE'), operator, machine, checks, missing, ts: Date.now() });
      if (missing.length) { const g = (s.gamification[operator] ??= { xp: 0, streak: 0, badges: [], quizzes: {} }); g.streak = 0; }
    });
    return missing;
  },
  broadcast(text, kind = 'Notice', by = 'SUP-01') {
    commit('broadcast', by, { kind }, (s) => { s.broadcasts.unshift({ id: uid('BC'), kind, text, ts: Date.now(), by }); });
  },
  assignTraining(operator, courseId, reason, by = 'SUP-01') {
    commit('training.assigned', by, { operator, courseId }, (s) => {
      if (s.training.some((t) => t.operator === operator && t.courseId === courseId && !t.done)) return;
      s.training.unshift({ id: uid('TR'), operator, courseId, reason, ts: Date.now(), by, done: false });
    });
  },
  completeQuiz(operator, courseId, score, total) {
    commit('training.completed', operator, { operator, courseId, score, total }, (s) => {
      const g = (s.gamification[operator] ??= { xp: 0, streak: 0, badges: [], quizzes: {} });
      const best = Math.max(g.quizzes[courseId] ?? 0, score);
      g.quizzes[courseId] = best;
      g.xp += score * 20;
      const passed = score / total >= 0.8;
      if (passed) {
        const badge = { 'blind-spot': 'Blind Spot Master', emergency: 'First Responder', 'excavator-safety': 'Smooth Operator', weather: 'Storm Ready' }[courseId];
        if (badge && !g.badges.includes(badge)) g.badges.push(badge);
        s.training.filter((t) => t.operator === operator && t.courseId === courseId).forEach((t) => { t.done = true; });
      }
    });
  },
  setWeather(w, source) {
    commit('weather.update', source, w, (s) => { s.weather = { ...s.weather, ...w, source, updatedAt: Date.now() }; });
  },
  recordReplan(r, by = 'replanner') {
    commit('plan.updated', by, { oldFinish: r.oldFinish, newFinish: r.newFinish, reasons: r.reasons }, (s) => {
      s.replans.unshift({ id: uid('RP'), ts: Date.now(), ...r });
      (r.pause ?? []).forEach((id) => { const t = s.tasks.find((x) => x.id === id); if (t && t.status !== 'done') t.status = 'paused'; });
      (r.resume ?? []).forEach((id) => { const t = s.tasks.find((x) => x.id === id); if (t && t.status === 'paused') t.status = 'assigned'; });
      (r.predictions ?? []).forEach(([id, p]) => { const t = s.tasks.find((x) => x.id === id); if (t) t.predicted = p; });
    });
  },
  startDrill(by = 'SUP-01') {
    commit('drill.started', by, {}, (s) => { s.drill = { ts: Date.now(), active: true, responses: {} }; });
  },
  respondDrill(operator) {
    commit('drill.response', operator, { operator }, (s) => { if (s.drill?.active && !s.drill.responses[operator]) s.drill.responses[operator] = Date.now(); });
  },
  endDrill(by = 'SUP-01') {
    commit('drill.ended', by, {}, (s) => { if (s.drill) s.drill.active = false; });
  },
};
