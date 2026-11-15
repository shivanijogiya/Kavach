import { useMemo, useState } from 'react';
import {
  LayoutDashboard, Truck, Users, ListChecks, MessageSquareWarning, LineChart as LineIcon, Megaphone, Siren, ShieldCheck,
  AlertTriangle, CloudRain, RotateCcw, Send, Link2,
} from 'lucide-react';
import { useData } from '../lib/data';
import { useSite, actions, verifyAudit, resetDemo, getState } from '../lib/store';
import { useSiteSim } from '../lib/sim';
import { predictMinutes, predictionFactors, replan, planFinish, fmtTime, fmtAgo, n } from '../lib/engines';
import { TASKS_FOR, ZONES, WEATHERS, WEATHER_UNSAFE, SUPERVISOR } from '../lib/config';
import { toolboxTalk } from '../lib/copilot';
import Shell from '../components/Shell';
import Copilot from '../components/Copilot';
import SiteMap from '../components/SiteMap';
import { Panel, Kpi, Badge, Seg, Toasts, Empty } from '../components/ui';
import { Fleet, Crew, Planner } from './SupervisorInsights';

const STATUS = { assigned: ['Assigned', 'info'], in_progress: ['In progress', 'warn'], done: ['Done', 'ok'], paused: ['Paused (weather)', 'danger'], blocked: ['Blocked', 'danger'] };

export default function Supervisor({ onLogout }) {
  const data = useData();
  const site = useSite();
  const { model } = data.tasks;
  const [tab, setTab] = useState('command');

  // machines on the live map: those with work today, topped up to 12
  const mapMachines = useMemo(() => {
    const ids = [...new Set(site.tasks.map((t) => t.machine))];
    ['EXC012', 'DOZ015', 'GRD018', 'LOD020', 'EXC021', 'LOD011'].forEach((id) => ids.length < 12 && !ids.includes(id) && ids.push(id));
    return ids.map((id) => data.machineById[id]).filter(Boolean);
  }, [site.tasks.map((t) => t.machine).join(','), data]);
  const snap = useSiteSim(mapMachines, data.operators, site.weather);

  const onShift = site.timesheets.filter((t) => !t.out);
  const openIssues = site.issues.filter((i) => i.status !== 'resolved');
  const activeSOS = site.sos.filter((s) => s.status !== 'resolved');
  const liveTasks = site.tasks.filter((t) => t.status !== 'done');
  const pOf = (t) => predictMinutes(model, { type: t.type, est: t.est, weather: site.weather.condition, skill: data.opById[t.operator]?.skill, age: 2026 - (data.machineById[t.machine]?.year ?? 2020) });
  const finish = planFinish(liveTasks, pOf);

  const applyWeather = (condition) => {
    const prev = site.weather.condition;
    const temps = { Sunny: 34, Cloudy: 29, Windy: 28, Foggy: 22, Rainy: 24, Snowy: -2 };
    const vis = { Foggy: 0.3, Rainy: 3, Snowy: 1 }[condition] ?? 10;
    actions.setWeather({ condition, temp: temps[condition], visibility: vis, wind: condition === 'Windy' ? 38 : 10, humidity: condition === 'Rainy' ? 92 : 60 }, 'what-if');
    const r = replan({ tasks: getState().tasks, model, weather: condition, prevWeather: prev, opsById: data.opById, machinesById: data.machineById });
    actions.recordReplan(r);
  };

  const nav = [
    { id: 'command', label: 'Command center', icon: LayoutDashboard, count: activeSOS.length || null, red: true },
    { id: 'tasks', label: 'Tasks and plan', icon: ListChecks, count: liveTasks.length || null },
    { id: 'issues', label: 'Issues and SOS', icon: MessageSquareWarning, count: openIssues.length + activeSOS.length || null, red: activeSOS.length > 0 },
    { id: 'fleet', label: 'Fleet', icon: Truck },
    { id: 'crew', label: 'Crew', icon: Users },
    { id: 'planner', label: 'Planning insights', icon: LineIcon },
    { id: 'broadcast', label: 'Broadcast', icon: Megaphone },
  ];
  const titles = {
    command: ['Command center', 'Live crew, fleet, zones and alerts'],
    tasks: ['Tasks and plan', 'Assign work and keep the plan current'],
    issues: ['Issues and SOS', 'Complaints, reports, emergencies and the audit trail'],
    fleet: ['Fleet', `${data.machines.length} machines, telemetry ${data.fleet.kpis.from} to ${data.fleet.kpis.to}`],
    crew: ['Crew', 'Behaviour, hours and training'],
    planner: ['Planning insights', 'What 100,000 past tasks say about time estimates'],
    broadcast: ['Broadcast', 'Messages and toolbox talks for the whole crew'],
  }[tab];

  return (
    <Shell nav={nav} active={tab} onNav={setTab} title={titles[0]} sub={titles[1]} weather={site.weather}
      user={{ name: SUPERVISOR.name, meta: SUPERVISOR.id }} onLogout={onLogout}>

      {activeSOS.map((s) => (
        <div key={s.id} className={`alarm-banner ${s.drill ? 'drill' : ''}`} role="alert">
          <Siren size={22} />
          <strong>SOS {s.status === 'acknowledged' ? '(acknowledged)' : ''}</strong>
          <span>{s.type} from {s.operator} ({s.name ?? ''}) on {s.machine}, {s.location}. Machine state: {s.machineState}. {fmtAgo(s.ts)}.</span>
          <span style={{ flex: 1 }} />
          {s.status === 'active' && <button className="btn sm" onClick={() => actions.updateSOS(s.id, 'acknowledged', 'Supervisor acknowledged. First aider dispatched, ETA 4 min.')}>Acknowledge and dispatch</button>}
          <button className="btn sm" onClick={() => actions.updateSOS(s.id, 'resolved', 'Resolved by supervisor. Incident report created.')}>Resolve</button>
        </div>
      ))}

      {tab === 'command' && (
        <>
          <div className="grid g4">
            <Kpi value={onShift.length} label="Crew on shift" detail={`${snap.workers.length} ground crew on the map`} />
            <Kpi value={liveTasks.length} label="Open tasks" detail={`Predicted site finish ${fmtTime(finish)}`} tone={liveTasks.some((t) => t.status === 'paused') ? 'warn' : undefined} />
            <Kpi value={snap.risks.filter((r) => r.level === 'critical').length} label="Critical proximity risks now" detail={`${snap.risks.length} above warning`} tone={snap.risks.some((r) => r.level === 'critical') ? 'danger' : 'ok'} />
            <Kpi value={openIssues.length} label="Open issues" detail={`${openIssues.filter((i) => i.severity === 'High').length} high severity`} tone={openIssues.some((i) => i.severity === 'High') ? 'warn' : undefined} />
          </div>
          <div className="grid g-8-4">
            <Panel title="Live site" sub="Machines, swing radii, zones and ground crew, updated every second."
              action={<button className="btn sm" onPointerDown={() => snap.triggerHazard(true)} onPointerUp={() => snap.triggerHazard(false)} onPointerLeave={() => snap.triggerHazard(false)}>Demo: hold to walk a worker behind a machine</button>}>
              <SiteMap snap={snap} />
            </Panel>
            <div className="stack" style={{ gap: 18 }}>
              <Panel title="What-if: weather" sub="Set conditions to see the plan react. Live weather returns when you choose Live.">
                <div className="row" style={{ gap: 6 }}>
                  {WEATHERS.map((w) => <button key={w} className={`btn sm ${site.weather.condition === w && site.weather.source === 'what-if' ? 'primary' : ''}`} onClick={() => applyWeather(w)}>{w}</button>)}
                  <button className="btn sm ghost" onClick={() => actions.setWeather({ ...site.weather, updatedAt: 0 }, 'default')}><RotateCcw size={13} /> Live</button>
                </div>
                {site.replans[0] && (
                  <div style={{ marginTop: 12, background: 'var(--paint-soft)', padding: '10px 12px', borderRadius: 4 }}>
                    <strong>Plan updated {fmtAgo(site.replans[0].ts)}</strong>
                    <p className="small">Finish {fmtTime(site.replans[0].oldFinish)} → <strong>{fmtTime(site.replans[0].newFinish)}</strong>, {site.replans[0].reasons.length} reason{site.replans[0].reasons.length === 1 ? '' : 's'}</p>
                    <ul className="briefing small" style={{ marginTop: 6 }}>{site.replans[0].reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                  </div>
                )}
              </Panel>
              <Panel title="Live alerts" sub="From the geofence and collision engines.">
                <div className="list" style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {snap.alerts.length ? snap.alerts.slice(0, 12).map((a) => (
                    <div className="item" key={a.id}>
                      <div className="icon" style={{ background: a.sev === 'critical' ? 'var(--danger-soft)' : 'var(--warn-soft)', color: a.sev === 'critical' ? 'var(--danger)' : 'var(--warn)' }}><AlertTriangle size={15} /></div>
                      <div><p style={{ fontSize: 13 }}>{a.text}</p><span className="small muted">{a.kind} {fmtAgo(a.ts)}</span></div>
                    </div>
                  )) : <Empty>No alerts. The site is clear.</Empty>}
                </div>
              </Panel>
            </div>
          </div>
          <div className="grid g2">
            <Panel title="Crew on shift">
              {onShift.length ? (
                <table className="t"><thead><tr><th>Operator</th><th>Machine</th><th>Since</th><th>Current task</th><th>PPE</th></tr></thead>
                  <tbody>{onShift.map((s) => {
                    const t = site.tasks.find((x) => x.operator === s.operator && x.status === 'in_progress');
                    const ppe = site.ppe.find((p) => p.operator === s.operator);
                    return <tr key={s.id}><td><strong>{s.operator}</strong> <span className="small muted">{data.opById[s.operator]?.name}</span></td><td>{s.machine}</td><td>{fmtTime(s.in)}</td><td>{t ? t.type : <span className="muted">none</span>}</td><td>{ppe ? (ppe.missing.length ? <Badge tone="danger">Missing {ppe.missing.length}</Badge> : <Badge tone="ok">OK</Badge>) : <Badge>-</Badge>}</td></tr>;
                  })}</tbody></table>
              ) : <Empty>Nobody has started a shift yet. Sign in as an operator in another tab to see them here.</Empty>}
            </Panel>
            <Panel title="Recent activity" sub="Every event on the site bus.">
              <div className="list" style={{ maxHeight: 280, overflowY: 'auto' }}>
                {site.events.slice(0, 14).map((e) => (
                  <div className="item" key={e.id} style={{ padding: '7px 0' }}>
                    <Badge tone={e.type.startsWith('sos') ? 'danger' : e.type.startsWith('issue') || e.type === 'ppe.violation' ? 'warn' : 'neutral'}>{e.type}</Badge>
                    <span className="small" style={{ flex: 1 }}>{e.source} {e.payload?.type ?? e.payload?.category ?? e.payload?.status ?? e.payload?.condition ?? ''} {e.payload?.machine ?? ''}</span>
                    <span className="small muted">{fmtAgo(e.ts)}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </>
      )}

      {tab === 'tasks' && <Tasks site={site} data={data} pOf={pOf} finish={finish} applyWeather={applyWeather} />}
      {tab === 'issues' && <Issues site={site} data={data} />}
      {tab === 'fleet' && <Fleet />}
      {tab === 'crew' && <Crew site={site} />}
      {tab === 'planner' && <Planner />}
      {tab === 'broadcast' && <Broadcast site={site} data={data} alerts={snap.alerts} />}

      <Copilot ctx={{ role: 'supervisor', tasks: site.tasks.map((t) => ({ ...t, predicted: pOf(t) })), weather: site.weather, siteSnap: snap, replans: site.replans, model }}
        suggestions={['Who is closest to EXC001?', 'Why did the plan change?', 'How long will trenching take?', 'Weather?']} />
      <Toasts events={site.events} filter={(e) => e.source !== SUPERVISOR.id && ['sos.raised', 'issue.raised', 'ppe.violation', 'task.updated', 'shift.started', 'training.completed', 'drill.response'].includes(e.type)}
        describe={(e) => ({
          'sos.raised': () => ({ title: `SOS from ${e.source}`, text: `${e.payload.type} on ${e.payload.machine}`, critical: true }),
          'issue.raised': () => ({ title: `New ${e.payload.category?.toLowerCase()}`, text: `${e.source} on ${e.payload.machine}, ${e.payload.severity} severity`, critical: e.payload.severity === 'High' }),
          'ppe.violation': () => ({ title: 'PPE missing', text: `${e.source}: ${e.payload.missing.join(', ')}`, critical: true }),
          'task.updated': () => ({ title: 'Task update', text: `${e.source} set a task to ${e.payload.status.replace('_', ' ')}` }),
          'shift.started': () => ({ title: 'Shift started', text: `${e.source} on ${e.payload.machine}` }),
          'training.completed': () => ({ title: 'Quiz completed', text: `${e.source}: ${e.payload.score}/${e.payload.total}` }),
          'drill.response': () => ({ title: 'Drill check-in', text: `${e.source} reached the muster point` }),
        }[e.type]?.() ?? {})} />
    </Shell>
  );
}

// ---------------- Tasks ----------------
function Tasks({ site, data, pOf, finish, applyWeather }) {
  const { model } = data.tasks;
  const [f, setF] = useState({ operator: 'OP1001', machine: 'EXC001', type: 'Trenching', zone: ZONES[1], priority: 'Medium', est: model.baseEstimate.Trenching, notes: '' });
  const [msg, setMsg] = useState('');
  const mach = data.machineById[f.machine.toUpperCase()];
  const op = data.opById[f.operator];
  const allowed = mach ? TASKS_FOR[mach.type] : [];
  const pred = mach && op ? predictMinutes(model, { type: f.type, est: f.est, weather: site.weather.condition, skill: op.skill, age: 2026 - mach.year }) : null;
  const unsafe = (WEATHER_UNSAFE[site.weather.condition] ?? []).includes(f.type);
  const cols = [['assigned', 'Assigned'], ['in_progress', 'In progress'], ['paused', 'Paused or blocked'], ['done', 'Done']];

  const submit = (e) => {
    e.preventDefault();
    if (!mach) return setMsg('Unknown machine ID.');
    if (!allowed.includes(f.type)) return setMsg(`${mach.id} is a ${mach.typeName.toLowerCase()}; it cannot do ${f.type.toLowerCase()}.`);
    if (mach.health < 40) return setMsg(`${mach.id} health is ${mach.health}. It must be serviced before use.`);
    actions.assignTask({ ...f, machine: mach.id, predicted: pred });
    setMsg(`Sent to ${f.operator}. It appears on their dashboard now.`);
    setF({ ...f, notes: '' });
  };

  return (
    <>
      <div className="grid g-7-5">
        <Panel title="Assign a task" sub="Constraints are checked before sending: machine type, machine health and weather safety.">
          <form className="form-grid" onSubmit={submit}>
            <div className="field"><label>Operator</label>
              <select className="input" value={f.operator} onChange={(e) => setF({ ...f, operator: e.target.value })}>
                {data.operators.map((o) => <option key={o.id} value={o.id}>{o.id} {o.name} ({o.skill})</option>)}
              </select></div>
            <div className="field"><label>Machine ID</label>
              <input className="input" list="sup-machines" value={f.machine} onChange={(e) => { const id = e.target.value.toUpperCase(); const m = data.machineById[id]; setF({ ...f, machine: id, ...(m && !TASKS_FOR[m.type].includes(f.type) ? { type: TASKS_FOR[m.type][0], est: model.baseEstimate[TASKS_FOR[m.type][0]] } : {}) }); }} />
              <datalist id="sup-machines">{data.machines.map((m) => <option key={m.id} value={m.id}>{m.model}</option>)}</datalist></div>
            <div className="field"><label>Task</label>
              <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value, est: model.baseEstimate[e.target.value] })}>
                {(allowed.length ? allowed : Object.keys(model.baseEstimate)).map((t) => <option key={t}>{t}</option>)}
              </select></div>
            <div className="field"><label>Zone</label>
              <select className="input" value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value })}>{ZONES.map((z) => <option key={z}>{z}</option>)}</select></div>
            <div className="field"><label>Priority</label>
              <Seg label="Priority" value={f.priority} onChange={(v) => setF({ ...f, priority: v })} options={['Low', 'Medium', 'High']} /></div>
            <div className="field"><label>Planned minutes</label><input className="input" type="number" min="5" value={f.est} onChange={(e) => setF({ ...f, est: +e.target.value || 0 })} /></div>
            <div className="field full"><label>Instructions (optional)</label><textarea className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="e.g. Keep 1.5 m clear of the marked cable at chainage 80" /></div>
            <div className="full row">
              <button className="btn primary"><Send size={14} /> Assign task</button>
              {msg && <span className="small">{msg}</span>}
            </div>
          </form>
        </Panel>
        <Panel title="Before you send" sub="Predicted time for this operator, machine and today's weather.">
          {pred ? (
            <div className="stack">
              <div className="row" style={{ gap: 20, alignItems: 'flex-end' }}>
                <div><div className="small muted">Planned</div><div style={{ font: '600 30px var(--display)' }}>{f.est} min</div></div>
                <div><div className="small muted">Predicted</div><div style={{ font: '700 40px/1 var(--display)' }}>{pred} min</div></div>
              </div>
              {predictionFactors(model, { weather: site.weather.condition, skill: op.skill, age: 2026 - mach.year }).map((x) => (
                <div key={x.label} className="row between small"><span>{x.label}</span><strong style={{ color: x.pct > 0 ? 'var(--danger)' : 'var(--ok)' }}>{x.pct > 0 ? '+' : ''}{x.pct.toFixed(1)}%</strong></div>
              ))}
              <div className="divider" />
              <div className="row"><Badge tone={mach.health >= 60 ? 'ok' : 'warn'}>{mach.id} health {mach.health}</Badge><Badge tone="info">{op.skill}</Badge>{unsafe && <Badge tone="danger">Unsafe in {site.weather.condition.toLowerCase()}: will be paused</Badge>}</div>
            </div>
          ) : <Empty>Enter a valid machine ID.</Empty>}
        </Panel>
      </div>
      <Panel title="Task board" sub={`${site.tasks.filter((t) => t.status !== 'done').length} open. Predicted site finish ${fmtTime(finish)}. Operators update their own cards.`}
        action={<button className="btn sm" onClick={() => applyWeather('Rainy')}><CloudRain size={14} /> Simulate rain and re-plan</button>}>
        <div className="kanban">
          {cols.map(([k, label]) => {
            const items = site.tasks.filter((t) => (k === 'paused' ? ['paused', 'blocked'].includes(t.status) : t.status === k));
            return (
              <div className="col" key={k}>
                <h3>{label}<span className="muted">{items.length}</span></h3>
                {items.map((t) => (
                  <div className={`tcard pri-${t.priority}`} key={t.id}>
                    <div className="row between"><span className="tt">{t.type}</span><Badge tone={STATUS[t.status][1]}>{t.priority}</Badge></div>
                    <div className="small muted">{t.operator} {data.opById[t.operator]?.name}, {t.machine}</div>
                    <div className="small">{t.zone}</div>
                    <div className="small" style={{ marginTop: 4 }}>{t.status === 'done' && t.doneAt && t.startedAt ? `Took ${Math.round((t.doneAt - t.startedAt) / 60000)} min (plan ${t.est})` : `Plan ${t.est} min, predicted ${pOf(t)} min`}</div>
                    {t.notes && <div className="small" style={{ marginTop: 4, color: t.status === 'blocked' ? 'var(--danger)' : 'var(--ink-2)' }}>{t.notes.split('\n').slice(-1)[0]}</div>}
                    {['paused', 'blocked'].includes(t.status) && <button className="btn sm" style={{ marginTop: 6 }} onClick={() => actions.setTaskStatus(t.id, 'assigned', SUPERVISOR.id, 'Released by supervisor')}>Release</button>}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </Panel>
    </>
  );
}

// ---------------- Issues, SOS, drills, audit ----------------
function Issues({ site, data }) {
  const [reply, setReply] = useState({});
  const [filter, setFilter] = useState('open');
  const audit = verifyAudit(site.audit);
  const list = site.issues.filter((i) => (filter === 'open' ? i.status !== 'resolved' : true));
  const drill = site.drill;
  const onShift = site.timesheets.filter((t) => !t.out).map((t) => t.operator);
  return (
    <>
      <Panel title="Issues and complaints" sub="Everything operators report. Replies appear on their dashboard." action={<Seg label="Filter" value={filter} onChange={setFilter} options={[{ value: 'open', label: 'Open' }, { value: 'all', label: 'All' }]} />}>
        {list.length ? (
          <div className="list">{list.map((i) => (
            <div className="item" key={i.id}>
              <div style={{ flex: 1 }}>
                <div className="row"><strong>{i.category}</strong><Badge tone={i.severity === 'High' ? 'danger' : i.severity === 'Medium' ? 'warn' : 'info'}>{i.severity}</Badge><Badge tone={i.status === 'resolved' ? 'ok' : i.status === 'acknowledged' ? 'info' : 'neutral'}>{i.status}</Badge>
                  <span className="small muted">{i.operator} {data.opById[i.operator]?.name}, {i.machine}, {fmtAgo(i.ts)}</span></div>
                <p style={{ marginTop: 4 }}>{i.text}</p>
                {i.replies.map((r) => <p key={r.ts} className="small" style={{ marginTop: 4, paddingLeft: 10, borderLeft: '3px solid var(--paint)' }}>{r.text}</p>)}
                {i.status !== 'resolved' && (
                  <div className="row" style={{ marginTop: 8 }}>
                    <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="Reply to the operator" value={reply[i.id] ?? ''} onChange={(e) => setReply({ ...reply, [i.id]: e.target.value })} />
                    <button className="btn sm" onClick={() => { actions.respondIssue(i.id, 'acknowledged', reply[i.id]); setReply({ ...reply, [i.id]: '' }); }}>Acknowledge</button>
                    <button className="btn sm primary" onClick={() => { actions.respondIssue(i.id, 'resolved', reply[i.id] || 'Resolved.'); setReply({ ...reply, [i.id]: '' }); }}>Resolve</button>
                  </div>
                )}
              </div>
            </div>
          ))}</div>
        ) : <Empty>No open issues.</Empty>}
      </Panel>
      <div className="grid g2">
        <Panel title="SOS log" sub="Each SOS keeps a full timeline, which becomes the incident report.">
          {site.sos.length ? site.sos.slice(0, 6).map((s) => (
            <div key={s.id} style={{ marginBottom: 14 }}>
              <div className="row"><strong>{s.type}</strong><Badge tone={s.status === 'resolved' ? 'ok' : 'danger'}>{s.status}</Badge>{s.drill && <Badge tone="warn">Drill</Badge>}<span className="small muted">{s.operator}, {s.machine}, {fmtAgo(s.ts)}</span></div>
              <ul className="briefing small" style={{ marginTop: 4 }}>{s.timeline.map((t) => <li key={t.ts + t.text}>{fmtTime(t.ts)} {t.text}</li>)}</ul>
              {s.ackAt && <p className="small muted">Response time {Math.round((s.ackAt - s.ts) / 1000)} s</p>}
            </div>
          )) : <Empty>No SOS events.</Empty>}
        </Panel>
        <Panel title="Emergency drill" sub="Sends a drill alarm to every operator. Their check-in times are scored.">
          <div className="row">
            {!drill?.active ? <button className="btn danger" onClick={() => actions.startDrill()}><Siren size={15} /> Start drill</button>
              : <button className="btn" onClick={() => actions.endDrill()}>End drill</button>}
            {drill && <span className="small muted">Started {fmtTime(drill.ts)}</span>}
          </div>
          {drill && (
            <table className="t" style={{ marginTop: 12 }}>
              <thead><tr><th>Operator</th><th className="r">Time to muster</th><th>Result</th></tr></thead>
              <tbody>
                {Object.entries(drill.responses ?? {}).map(([op, ts]) => { const s = Math.round((ts - drill.ts) / 1000); return <tr key={op}><td>{op}</td><td className="r">{s} s</td><td><Badge tone={s <= 180 ? 'ok' : 'warn'}>{s <= 180 ? 'Pass' : 'Slow'}</Badge></td></tr>; })}
                {onShift.filter((o) => !drill.responses?.[o]).map((o) => <tr key={o}><td>{o}</td><td className="r">-</td><td><Badge tone="danger">Not checked in</Badge></td></tr>)}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
      <Panel title="Tamper-evident audit trail" sub="Every SOS, issue, PPE violation, task assignment and plan change is hash-chained with SHA-256. Editing any past record breaks the chain."
        action={<Badge tone={audit.ok ? 'ok' : 'danger'}>{audit.ok ? <><ShieldCheck size={13} /> Chain verified, {audit.length} records</> : `Broken at record ${audit.brokenAt}`}</Badge>}>
        <div className="table-wrap" style={{ maxHeight: 300, overflowY: 'auto' }}>
          <table className="t"><thead><tr><th>#</th><th>Time</th><th>Event</th><th>By</th><th>Hash</th><th>Previous</th></tr></thead>
            <tbody>{site.audit.slice(0, 40).map((a) => <tr key={a.i}><td>{a.i}</td><td className="small">{fmtTime(a.ts)}</td><td>{a.type}</td><td>{a.source}</td><td className="hash"><Link2 size={11} /> {a.hash.slice(0, 16)}…</td><td className="hash">{a.prev.slice(0, 10)}…</td></tr>)}</tbody></table>
        </div>
      </Panel>
    </>
  );
}

// ---------------- Broadcast ----------------
function Broadcast({ site, data, alerts }) {
  const [text, setText] = useState('');
  const [kind, setKind] = useState('Notice');
  const draft = () => {
    setKind('Toolbox talk');
    setText(toolboxTalk({ weather: site.weather, alerts, issues: site.issues.filter((i) => i.status !== 'resolved'), seatbelt: data.fleet.seatbeltAlert }));
  };
  return (
    <div className="grid g-7-5">
      <Panel title="Send to all operators" sub="Appears on every operator dashboard and as a live notification.">
        <div className="stack">
          <div className="row"><Seg label="Kind" value={kind} onChange={setKind} options={['Notice', 'Toolbox talk', 'Safety alert', 'Schedule change']} /><button className="btn sm" onClick={draft}>Draft today's toolbox talk</button></div>
          <textarea className="input" rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message for the crew" />
          <div className="row"><button className="btn primary" disabled={!text.trim()} onClick={() => { actions.broadcast(text.trim(), kind); setText(''); }}><Megaphone size={14} /> Send</button>
            <button className="btn ghost sm" onClick={() => { if (window.confirm('Reset all demo data (tasks, issues, SOS, timesheets)?')) resetDemo(); }}><RotateCcw size={13} /> Reset demo data</button></div>
        </div>
      </Panel>
      <Panel title="Sent">
        {site.broadcasts.length ? <div className="list">{site.broadcasts.map((b) => (
          <div className="item" key={b.id}><div><strong>{b.kind}</strong> <span className="small muted">{fmtAgo(b.ts)}</span><p style={{ marginTop: 3 }}>{b.text}</p></div></div>
        ))}</div> : <Empty>Nothing sent yet.</Empty>}
      </Panel>
    </div>
  );
}
