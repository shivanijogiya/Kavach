import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, Cell,
} from 'recharts';
import {
  Gauge as GaugeIcon, History, ListChecks, ShieldAlert, MessageSquareWarning, GraduationCap, Volume2, Play, CheckCircle2,
  Coffee, LogIn, LogOut, HardHat, Shirt, Footprints, Armchair, Megaphone, AlertTriangle, Siren, Hand, Glasses,
} from 'lucide-react';
import { useData } from '../lib/data';
import { useSite, actions } from '../lib/store';
import { useMachineTelemetry, telemetryAlerts, useCabRadar } from '../lib/sim';
import { liveHealth, healthLabel, healthTone, predictMinutes, fatigueScore, fmtTime, fmtAgo, fmtDate, n, daysToService, RISK_W, planFinish } from '../lib/engines';
import { THRESHOLDS, WEATHER_UNSAFE, TYPE_META } from '../lib/config';
import { buildBriefing, speak } from '../lib/copilot';
import Shell from '../components/Shell';
import Copilot from '../components/Copilot';
import Radar from '../components/Radar';
import LearningHub from '../components/LearningHub';
import { Panel, Kpi, Badge, Meter, Seg, Modal, ChartTip, axis, grid, Toasts, SOSButton, Empty } from '../components/ui';

const STATUS = { assigned: ['Assigned', 'info'], in_progress: ['In progress', 'warn'], done: ['Done', 'ok'], paused: ['Paused', 'danger'], blocked: ['Blocked', 'danger'] };
const SOS_TYPES = ['Injury', 'Machine rollover', 'Fire', 'Hydraulic burst', 'Trapped person', 'Gas or dust', 'Medical', 'Other emergency'];

function Gauge({ label, value, unit, state, sub }) {
  return (
    <div className={`gauge ${state ?? ''}`}>
      <div className="gl"><span>{label}</span>{state === 'crit' ? <Badge tone="danger">Alarm</Badge> : state === 'warn' ? <Badge tone="warn">Check</Badge> : null}</div>
      <div className="gv">{value}<small>{unit}</small></div>
      {sub}
    </div>
  );
}

export default function Operator({ session, onLogout }) {
  const data = useData();
  const site = useSite();
  const { model } = data.tasks;
  const m = data.machineById[session.machine];
  const op = data.opById[session.operator];
  const [tab, setTab] = useState('overview');
  const [lang, setLang] = useState('en');
  const [sosOpen, setSosOpen] = useState(null);
  const [ppe, setPpe] = useState({ helmet: false, vest: false, shoes: false, seatbelt: false, glasses: false, gloves: false });
  const [issue, setIssue] = useState({ category: 'Machine fault', severity: 'Medium', text: '' });
  const [sent, setSent] = useState('');

  const today = new Date().setHours(0, 0, 0, 0);
  const shift = site.timesheets.find((t) => t.operator === op.id && !t.out);
  const ppeToday = site.ppe.find((p) => p.operator === op.id && p.ts >= today);
  const ppeOk = ppeToday && !ppeToday.missing.length;
  const working = !!shift;
  const { tel, inject, clear } = useMachineTelemetry(m, { working, weather: site.weather });
  const radar = useCabRadar(m, { working, weather: site.weather });
  const health = liveHealth(m.health, tel);
  const alerts = telemetryAlerts(tel);
  const myTasks = site.tasks.filter((t) => t.operator === op.id || t.machine === m.id);
  const openTasks = myTasks.filter((t) => t.status !== 'done');
  const age = 2026 - m.year;
  const predict = (t) => predictMinutes(model, { type: t.type, est: t.est, weather: site.weather.condition, skill: op.skill, age });
  const finish = openTasks.length ? fmtTime(planFinish(openTasks.filter((t) => t.operator === op.id), predict)) : 'now';
  const hoursToday = shift ? (Date.now() - shift.in) / 3600000 : 0;
  const fat = fatigueScore({ hoursToday, tempC: site.weather.temp, humidity: site.weather.humidity, minsSinceBreak: shift ? (Date.now() - (shift.lastBreak ?? shift.in)) / 60000 : 0 });
  const unsafe = WEATHER_UNSAFE[site.weather.condition];
  const g = site.gamification[op.id];
  const myIssues = site.issues.filter((i) => i.operator === op.id);
  const myTraining = site.training.filter((t) => t.operator === op.id);
  const activeSOS = site.sos.find((s) => s.operator === op.id && s.status !== 'resolved');
  const drillPending = site.drill?.active && !site.drill.responses?.[op.id];
  const otherSOS = site.sos.find((s) => s.operator !== op.id && s.status === 'active' && !s.drill);

  const briefing = buildBriefing(lang, {
    name: op.name.split(' ')[0], machine: `${m.id} (${m.model})`, health: health.score, fuel: tel.fuelPct.toFixed(0),
    tasks: openTasks.filter((t) => t.operator === op.id), weather: site.weather, unsafe: unsafe?.join(', '), finish,
    focus: op.unbeltedRate > 0.12 ? 'your seatbelt record is below the site target. Buckle up before you start.' : radar.top?.level !== 'safe' && radar.top ? 'people are working close to your machine. Check mirrors before every reverse.' : 'keep the swing radius clear and sound the horn before moving.',
  });

  // weekly timesheet
  const week = useMemo(() => {
    const days = [];
    for (let d = 6; d >= 0; d--) {
      const start = today - d * 86400000;
      const hrs = site.timesheets.filter((t) => t.operator === op.id && t.in >= start && t.in < start + 86400000)
        .reduce((a, t) => a + ((t.out ?? Date.now()) - t.in) / 3600000 - (t.breaks ?? 0) / 60, 0);
      days.push({ day: new Date(start).toLocaleDateString([], { weekday: 'short' }), hours: +Math.max(0, hrs).toFixed(1) });
    }
    return days;
  }, [site.timesheets, op.id, today, Math.floor(Date.now() / 60000)]);
  const weekTotal = week.reduce((a, d) => a + d.hours, 0);

  const fireSOS = (type = 'Emergency (type not set)') => {
    const s = actions.raiseSOS({ operator: op.id, name: op.name, machine: m.id, type, location: 'Near ' + (openTasks[0]?.zone ?? 'assigned work area'), machineState: `${tel.mode}, ${tel.load.toFixed(0)}% load, ${tel.speed.toFixed(1)} km/h, engine ${tel.engineTemp.toFixed(0)}°C` });
    setSosOpen(s.id);
  };

  const nav = [
    { id: 'overview', label: 'Today', icon: GaugeIcon, count: alerts.filter((a) => a.sev === 'critical').length || null, red: true },
    { id: 'history', label: 'Machine history', icon: History },
    { id: 'tasks', label: 'My tasks', icon: ListChecks, count: openTasks.length || null },
    { id: 'safety', label: 'Safety', icon: ShieldAlert, count: radar.top?.level === 'critical' ? '!' : null, red: true },
    { id: 'report', label: 'Issues and hours', icon: MessageSquareWarning, count: myIssues.filter((i) => i.replies.length && i.status !== 'resolved').length || null },
    { id: 'learn', label: 'Learn', icon: GraduationCap, count: myTraining.filter((t) => !t.done).length || null, red: true },
  ];

  const tempState = tel.engineTemp >= THRESHOLDS.engineTemp.crit ? 'crit' : tel.engineTemp >= THRESHOLDS.engineTemp.warn ? 'warn' : '';
  const hydState = tel.hydraulic < THRESHOLDS.hydraulic.low || tel.hydraulic > THRESHOLDS.hydraulic.high ? 'crit' : tel.drift ? 'warn' : '';
  const fuelState = tel.fuelPct < THRESHOLDS.fuel.crit ? 'crit' : tel.fuelPct < THRESHOLDS.fuel.low ? 'warn' : '';

  const header = {
    overview: ['Today', `${m.id} ${m.model} ${m.typeName.toLowerCase()}`],
    history: ['Machine history', `Everything ${m.id} did over the logged year, up to ${m.lastSeen}`],
    tasks: ['My tasks', 'Assigned by your supervisor and the work left on this machine'],
    safety: ['Safety', 'Proximity radar, your safety record and fatigue'],
    report: ['Issues and hours', 'Report a problem and see your time on site'],
    learn: ['Learn', 'Official Cat videos, animated lessons and quizzes'],
  }[tab];

  return (
    <Shell nav={nav} active={tab} onNav={setTab} title={header[0]} sub={header[1]} weather={site.weather}
      user={{ name: `${op.name} (${op.id})`, meta: `${op.skill} operator on ${m.id}` }} onLogout={onLogout}
      right={<SOSButton onFire={() => fireSOS()} />}>

      {(activeSOS || drillPending || otherSOS) && (
        <div className={`alarm-banner ${drillPending && !activeSOS ? 'drill' : ''}`} role="alert">
          <Siren size={22} />
          {activeSOS ? (
            <><strong>SOS sent</strong><span>{activeSOS.status === 'acknowledged' ? 'Supervisor acknowledged. Help is on the way. Stay where you are if it is safe.' : 'Waiting for the supervisor to acknowledge. Machines within 30 m were sent a stop signal.'}</span>
              <button className="btn sm" onClick={() => setSosOpen(activeSOS.id)}>Open procedure</button></>
          ) : drillPending ? (
            <><strong>Emergency drill</strong><span>Walk to the muster point, then confirm.</span><button className="btn sm" onClick={() => actions.respondDrill(op.id)}>I am at the muster point</button></>
          ) : (
            <><strong>Site emergency</strong><span>{otherSOS.type} reported by {otherSOS.operator} near {otherSOS.machine}. Follow supervisor instructions and keep clear.</span></>
          )}
        </div>
      )}

      {tab === 'overview' && (
        <>
          <div className="plate">
            <span className="rivet" style={{ left: 24, top: 8 }} /><span className="rivet" style={{ right: 8, top: 8 }} />
            <span className="rivet" style={{ left: 24, bottom: 8 }} /><span className="rivet" style={{ right: 8, bottom: 8 }} />
            <div>
              <div className="id">{m.id}</div>
              <div className="model">{m.model} {m.typeName}, {m.year}</div>
              <div className="status-line">
                <span className="badge">{working ? (tel.mode === 'working' ? 'Working' : 'Idling') : 'Parked'}</span>
                <span className="badge">Fuel {tel.fuelPct.toFixed(0)}%</span>
                <span className="badge">{tel.cyclesToday} load cycles today</span>
                {alerts.filter((a) => a.sev === 'critical').length > 0 && <span className="badge alarm">{alerts.filter((a) => a.sev === 'critical').length} alarm</span>}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ font: '700 58px/0.9 var(--display)' }} className="num">{health.score}</div>
              <div style={{ fontWeight: 700 }}>Health: {healthLabel(health.score)}</div>
            </div>
            <dl className="spec">
              <dt>Engine hours</dt><dd>{n(m.engineHours, 1)}</dd>
              <dt>Next service</dt><dd>{n(m.serviceDueIn)} h (≈{daysToService(m)} days)</dd>
              <dt>Sessions logged</dt><dd>{n(m.sessions)}</dd>
              <dt>Last run by</dt><dd>{m.lastOperator}</dd>
            </dl>
          </div>

          {!ppeOk || !working ? (
            <div className="grid g-7-5">
              <Panel title="Pre-shift PPE check" sub="Tick what you are wearing right now. Your supervisor sees missing items.">
                <div className="ppe-grid">
                  {[['helmet', 'Hard hat', HardHat], ['vest', 'Hi-vis vest', Shirt], ['shoes', 'Safety boots', Footprints], ['seatbelt', 'Seatbelt works', Armchair], ['glasses', 'Eye protection', Glasses], ['gloves', 'Gloves', Hand]].map(([k, l, I]) => (
                    <button key={k} className="ppe" aria-pressed={ppe[k]} onClick={() => setPpe({ ...ppe, [k]: !ppe[k] })}><I size={20} />{l}</button>
                  ))}
                </div>
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn primary" onClick={() => actions.submitPPE(op.id, m.id, ppe)}>Submit PPE check</button>
                  {ppeToday && (ppeToday.missing.length
                    ? <Badge tone="danger">Missing: {ppeToday.missing.join(', ')}. Fix before starting.</Badge>
                    : <Badge tone="ok"><CheckCircle2 size={12} /> Checked at {fmtTime(ppeToday.ts)}</Badge>)}
                </div>
              </Panel>
              <Panel title="Start your shift" sub="Starting the shift starts live machine monitoring and your hours.">
                <div className="stack">
                  <p>{ppeOk ? 'PPE check passed. You are clear to start.' : 'Complete the PPE check first.'}</p>
                  <div><button className="btn paint" disabled={!ppeOk} onClick={() => actions.clockIn(op.id, m.id)}><LogIn size={16} /> Start shift on {m.id}</button></div>
                  <p className="small muted">Health {health.score}/100. {health.score < 40 ? 'Do not operate: contact your supervisor.' : 'Machine is fit to operate.'}</p>
                </div>
              </Panel>
            </div>
          ) : (
            <div className="grid g4">
              <Kpi value={hoursToday.toFixed(1)} unit="h" label="On shift today" detail={`Started ${fmtTime(shift.in)}`} />
              <Kpi value={openTasks.length} label="Tasks left" detail={`Predicted finish ${finish}`} tone={openTasks.some((t) => t.status === 'paused') ? 'warn' : undefined} />
              <Kpi value={fat.score} unit="/100" label={`Fatigue and heat: ${fat.level}`} detail={fat.advice} tone={fat.level === 'High' ? 'danger' : fat.level === 'Elevated' ? 'warn' : 'ok'} />
              <div className="kpi">
                <div className="l" style={{ marginTop: 0, marginBottom: 8 }}>Shift controls</div>
                <div className="row">
                  <button className="btn sm" onClick={() => actions.logBreak(op.id, 15)}><Coffee size={14} /> 15 min break</button>
                  <button className="btn sm" onClick={() => actions.clockOut(op.id)}><LogOut size={14} /> End shift</button>
                </div>
              </div>
            </div>
          )}

          <div className="grid g-7-5">
            <Panel title="Live machine condition" sub={working ? 'Eight signals from the machine, updated every second.' : 'Engine at idle. Start your shift to see working values.'}
              action={<select className="input" style={{ width: 'auto', fontSize: 12.5 }} value="" onChange={(e) => { if (e.target.value === 'clear') clear(); else if (e.target.value) inject(e.target.value); }} aria-label="Demo fault injection">
                <option value="">Demo: simulate a fault</option>
                <option value="hydraulic">Hydraulic leak</option><option value="overheat">Engine overheating</option>
                <option value="oil">Oil pressure loss</option><option value="fuel">Fast fuel drop</option><option value="battery">Weak battery</option>
                <option value="clear">Clear faults</option>
              </select>}>
              <div className="gauges">
                <Gauge label="Engine temp" value={tel.engineTemp.toFixed(0)} unit="°C" state={tempState} />
                <Gauge label="Hydraulic pressure" value={tel.hydraulic.toFixed(0)} unit="bar" state={hydState} />
                <Gauge label="Oil pressure" value={tel.oil.toFixed(0)} unit="kPa" state={tel.oil < THRESHOLDS.oil.low ? 'crit' : ''} />
                <Gauge label="Fuel" value={tel.fuelPct.toFixed(0)} unit="%" state={fuelState} sub={<Meter value={tel.fuelPct} color={fuelState ? 'var(--danger)' : 'var(--ok)'} label="Fuel level" />} />
                <Gauge label="Battery" value={tel.battery.toFixed(1)} unit="V" state={tel.battery < THRESHOLDS.battery.low ? 'warn' : ''} />
                <Gauge label="Engine speed" value={n(tel.rpm)} unit="rpm" />
                <Gauge label="Load" value={tel.load.toFixed(0)} unit="%" sub={<Meter value={tel.load} color="var(--info)" label="Load" />} />
                <Gauge label="Travel speed" value={tel.speed.toFixed(1)} unit="km/h" />
              </div>
              <div style={{ height: 180, marginTop: 14 }}>
                <ResponsiveContainer>
                  <LineChart data={tel.history} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid {...grid} />
                    <XAxis dataKey="t" {...axis} tickFormatter={(t) => `${t}s`} />
                    <YAxis yAxisId="l" {...axis} domain={[40, 120]} />
                    <YAxis yAxisId="r" orientation="right" {...axis} domain={[200, 420]} />
                    <Tooltip content={<ChartTip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <ReferenceLine yAxisId="r" y={THRESHOLDS.hydraulic.low} stroke="#C2361F" strokeDasharray="4 3" />
                    <Line yAxisId="l" dataKey="engineTemp" name="Engine °C" stroke="#C77700" dot={false} strokeWidth={2} isAnimationActive={false} />
                    <Line yAxisId="r" dataKey="hydraulic" name="Hydraulic bar" stroke="#2F6690" dot={false} strokeWidth={2} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <div className="stack" style={{ gap: 18 }}>
              <Panel title="Morning briefing" action={<div className="row"><Seg label="Language" value={lang} onChange={setLang} options={[{ value: 'en', label: 'EN' }, { value: 'hi', label: 'हिं' }, { value: 'ta', label: 'த' }]} /><button className="btn sm" onClick={() => speak(briefing, lang)} aria-label="Read briefing aloud"><Volume2 size={14} /></button></div>}>
                <ul className="briefing">{briefing.map((l) => <li key={l}>{l}</li>)}</ul>
              </Panel>
              <Panel title="Machine alerts">
                {alerts.length || health.reasons.length ? (
                  <div className="list">
                    {alerts.map((a) => (
                      <div className="item" key={a.text}>
                        <div className="icon" style={{ background: a.sev === 'critical' ? 'var(--danger-soft)' : 'var(--warn-soft)', color: a.sev === 'critical' ? 'var(--danger)' : 'var(--warn)' }}><AlertTriangle size={16} /></div>
                        <div style={{ flex: 1 }}><p>{a.text}</p></div>
                      </div>
                    ))}
                    <div className="row" style={{ paddingTop: 8 }}>
                      <button className="btn sm" onClick={() => { actions.raiseIssue({ operator: op.id, machine: m.id, category: 'Machine fault', severity: alerts.some((a) => a.sev === 'critical') ? 'High' : 'Medium', text: `Auto-report from ${m.id}: ${alerts.map((a) => a.text).join(' ')}` }); setSent('Sent to supervisor with live readings.'); }}>Send to supervisor</button>
                      {sent && <span className="small muted">{sent}</span>}
                    </div>
                  </div>
                ) : <Empty>All signals normal.</Empty>}
              </Panel>
            </div>
          </div>

          <div className="grid g2">
            <Panel title="Next up" sub="Your open tasks with predicted time for today's conditions." action={<button className="btn sm" onClick={() => setTab('tasks')}>All tasks</button>}>
              {openTasks.length ? (
                <div className="list">{openTasks.slice(0, 3).map((t) => (
                  <div className="item" key={t.id}>
                    <div style={{ flex: 1 }}><strong>{t.type}</strong> <Badge tone={STATUS[t.status][1]}>{STATUS[t.status][0]}</Badge><p className="small muted">{t.zone}, about {predict(t)} min</p></div>
                    {t.status === 'assigned' && <button className="btn sm primary" disabled={!working} onClick={() => actions.setTaskStatus(t.id, 'in_progress', op.id)}><Play size={13} /> Start</button>}
                    {t.status === 'in_progress' && <button className="btn sm paint" onClick={() => actions.setTaskStatus(t.id, 'done', op.id)}><CheckCircle2 size={13} /> Done</button>}
                  </div>
                ))}</div>
              ) : <Empty>No open tasks. Your supervisor will assign the next one here.</Empty>}
            </Panel>
            <Panel title="From your supervisor">
              {site.broadcasts.length ? (
                <div className="list">{site.broadcasts.slice(0, 3).map((b) => (
                  <div className="item" key={b.id}>
                    <div className="icon" style={{ background: 'var(--paint-soft)', color: '#8a6d00' }}><Megaphone size={16} /></div>
                    <div><strong>{b.kind}</strong> <span className="small muted">{fmtAgo(b.ts)}</span><p style={{ marginTop: 2 }}>{b.text}</p></div>
                  </div>
                ))}</div>
              ) : <Empty>No messages yet.</Empty>}
            </Panel>
          </div>
        </>
      )}

      {tab === 'history' && <MachineHistory m={m} model={model} op={op} weather={site.weather} data={data} />}

      {tab === 'tasks' && (
        <>
          {site.replans[0] && Date.now() - site.replans[0].ts < 8 * 3600000 && (
            <Panel title="Plan changed" sub={`${fmtAgo(site.replans[0].ts)}: finish moved from ${fmtTime(site.replans[0].oldFinish)} to ${fmtTime(site.replans[0].newFinish)}`}>
              <ul className="briefing">{site.replans[0].reasons.map((r) => <li key={r}>{r}</li>)}</ul>
            </Panel>
          )}
          <Panel title="Assigned to you" sub={working ? 'Start a task when you begin it and mark it done when finished. Your supervisor sees every change live.' : 'Start your shift on the Today page to begin tasks.'}>
            {myTasks.length ? (
              <div className="table-wrap"><table className="t">
                <thead><tr><th>Task</th><th>Zone</th><th>Priority</th><th className="r">Planned</th><th className="r">Predicted</th><th>Status</th><th>Notes</th><th /></tr></thead>
                <tbody>{myTasks.map((t) => {
                  const p = predict(t);
                  const el = t.startedAt && t.status === 'in_progress' ? (Date.now() - t.startedAt) / 60000 : 0;
                  return (
                    <tr key={t.id}>
                      <td><strong>{t.type}</strong><div className="small muted">{t.machine}{t.operator !== op.id ? `, ${t.operator}` : ''}</div></td>
                      <td>{t.zone}</td>
                      <td><Badge tone={t.priority === 'High' ? 'danger' : t.priority === 'Medium' ? 'warn' : 'info'}>{t.priority}</Badge></td>
                      <td className="r">{t.est} min</td>
                      <td className="r">{t.status === 'done' && t.doneAt && t.startedAt ? `${Math.round((t.doneAt - t.startedAt) / 60000)} min actual` : `${p} min`}{t.status === 'in_progress' && <Meter value={el} max={p} color={el > p ? 'var(--danger)' : 'var(--warn)'} label="Progress" />}</td>
                      <td><Badge tone={STATUS[t.status][1]}>{STATUS[t.status][0]}</Badge></td>
                      <td className="small" style={{ maxWidth: 240 }}>{t.notes}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {t.operator === op.id && t.status === 'assigned' && <button className="btn sm primary" disabled={!working} onClick={() => actions.setTaskStatus(t.id, 'in_progress', op.id)}>Start</button>}
                        {t.operator === op.id && t.status === 'in_progress' && <button className="btn sm paint" onClick={() => actions.setTaskStatus(t.id, 'done', op.id)}>Mark done</button>}
                        {t.operator === op.id && ['assigned', 'in_progress'].includes(t.status) && <button className="btn sm ghost" onClick={() => { const why = window.prompt('What is blocking this task?'); if (why) { actions.setTaskStatus(t.id, 'blocked', op.id, `Blocked: ${why}`); actions.raiseIssue({ operator: op.id, machine: m.id, category: 'Task blocked', severity: 'Medium', text: `${t.type} in ${t.zone}: ${why}` }); } }}>Can't do</button>}
                        {t.status === 'blocked' && t.operator === op.id && <button className="btn sm" onClick={() => actions.setTaskStatus(t.id, 'assigned', op.id)}>Unblock</button>}
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
            ) : <Empty>Nothing assigned yet.</Empty>}
          </Panel>
          <Panel title={`Work left on ${m.id}`} sub="Backlog for this machine from the site task list. Predicted times use the model trained on 100,000 past tasks.">
            <div className="table-wrap"><table className="t">
              <thead><tr><th>Task ID</th><th>Type</th><th className="r">Planned</th><th className="r">Predicted today</th><th className="r">Difference</th></tr></thead>
              <tbody>{m.workQueue.map((t) => { const p = predict(t); return (
                <tr key={t.taskId}><td>{t.taskId}</td><td>{t.type}</td><td className="r">{t.est} min</td><td className="r"><strong>{p} min</strong></td><td className="r" style={{ color: p > t.est ? 'var(--danger)' : 'var(--ok)' }}>{p > t.est ? '+' : ''}{p - t.est} min</td></tr>
              ); })}</tbody>
              <tfoot><tr><td colSpan={2}><strong>Total</strong></td><td className="r">{m.workQueue.reduce((a, t) => a + t.est, 0)} min</td><td className="r"><strong>{m.workQueue.reduce((a, t) => a + predict(t), 0)} min</strong></td><td /></tr></tfoot>
            </table></div>
          </Panel>
        </>
      )}

      {tab === 'safety' && (
        <>
          <div className="grid g-7-5">
            <Panel title="Proximity radar" sub="People around your machine. Risk combines distance at closest approach, time to closest approach, blind spot, speed, visibility and ground."
              action={<button className="btn sm" onPointerDown={() => radar.forceHazard(true)} onPointerUp={() => radar.forceHazard(false)} onPointerLeave={() => radar.forceHazard(false)}>Demo: hold to walk a worker behind</button>}>
              <div className="radar-wrap">
                <Radar radar={radar} />
                <div className="stack">
                  {radar.top && (
                    <div className={`kpi tone-${radar.top.level === 'critical' ? 'danger' : radar.top.level === 'warning' ? 'warn' : 'ok'}`}>
                      <div className="v">{(radar.top.risk * 100).toFixed(0)}<small>% risk</small></div>
                      <div className="l">{radar.top.level === 'critical' ? `STOP: ${radar.top.name}` : radar.top.level === 'warning' ? `Caution: ${radar.top.name}` : 'All clear around the machine'}</div>
                      <div className="d">{radar.top.reasons.slice(0, 3).join(', ')}</div>
                    </div>
                  )}
                  <table className="t">
                    <tbody>{[...radar.workers].sort((a, b) => b.risk - a.risk).map((w) => (
                      <tr key={w.id}><td>{w.id}</td><td>{w.name}</td><td className="r">{w.dist.toFixed(0)} m</td><td><Badge tone={w.level === 'critical' ? 'danger' : w.level === 'warning' ? 'warn' : 'ok'}>{(w.risk * 100).toFixed(0)}%</Badge></td></tr>
                    ))}</tbody>
                  </table>
                  <p className="small muted">Risk = {RISK_W.w1}/(DCPA+1) + {RISK_W.w2}/(TCPA+1) + {RISK_W.w3}×blind spot + {RISK_W.w4}×speed×visibility×slope×ground. Warn above 50%, stop above 80%.</p>
                </div>
              </div>
            </Panel>
            <div className="stack" style={{ gap: 18 }}>
              <Panel title="Your safety record" sub={`All ${n(op.sessions)} of your logged sessions this year`}>
                <div className="grid g2" style={{ gap: 10 }}>
                  <Kpi value={op.score} unit="/100" label="Behaviour score" tone={op.score >= 70 ? 'ok' : op.score >= 50 ? 'warn' : 'danger'} />
                  <Kpi value={`${((1 - op.unbeltedRate) * 100).toFixed(1)}`} unit="%" label="Seatbelt fastened" tone={op.unbeltedRate > 0.12 ? 'warn' : 'ok'} />
                  <Kpi value={`${(op.alertRate * 100).toFixed(1)}`} unit="%" label="Sessions with an alert" detail={`Site average ${(data.fleetAvg.alertRate * 100).toFixed(1)}%`} />
                  <Kpi value={op.avgIdle.toFixed(1)} unit="min" label="Idle per session" detail={`Site average ${data.fleetAvg.avgIdle.toFixed(1)} min`} />
                </div>
                <p className="small" style={{ marginTop: 12, background: 'var(--paint-soft)', padding: '8px 10px', borderRadius: 4 }}>
                  Across the fleet, {data.fleet.seatbeltAlert.unfastened}% of sessions with an unfastened seatbelt triggered a safety alert, against {data.fleet.seatbeltAlert.fastened}% when fastened.
                </p>
              </Panel>
              <Panel title="Fatigue and heat stress" sub={`Heat index ${fat.heatIndex}°C, ${hoursToday.toFixed(1)} h on shift`}>
                <div className="row between"><strong style={{ font: '600 28px var(--display)' }}>{fat.score}/100</strong><Badge tone={fat.level === 'High' ? 'danger' : fat.level === 'Elevated' ? 'warn' : 'ok'}>{fat.level}</Badge></div>
                <Meter value={fat.score} color={fat.level === 'High' ? 'var(--danger)' : fat.level === 'Elevated' ? 'var(--warn)' : 'var(--ok)'} label="Fatigue" />
                <p style={{ marginTop: 8 }}>{fat.advice}</p>
              </Panel>
            </div>
          </div>
          <Panel title="PPE check history">
            {site.ppe.filter((p) => p.operator === op.id).length ? (
              <table className="t"><thead><tr><th>When</th><th>Machine</th><th>Result</th></tr></thead>
                <tbody>{site.ppe.filter((p) => p.operator === op.id).slice(0, 8).map((p) => (
                  <tr key={p.id}><td>{fmtDate(p.ts)} {fmtTime(p.ts)}</td><td>{p.machine}</td><td>{p.missing.length ? <Badge tone="danger">Missing {p.missing.join(', ')}</Badge> : <Badge tone="ok">All PPE worn</Badge>}</td></tr>
                ))}</tbody></table>
            ) : <Empty>No PPE checks yet today.</Empty>}
          </Panel>
        </>
      )}

      {tab === 'report' && (
        <>
          <div className="grid g-7-5">
            <Panel title="Report an issue" sub="Machine faults, site hazards, PPE problems or anything stopping your work. Goes straight to the supervisor.">
              <form className="form-grid" onSubmit={(e) => {
                e.preventDefault(); if (!issue.text.trim()) return;
                actions.raiseIssue({ operator: op.id, machine: m.id, ...issue }); setIssue({ ...issue, text: '' }); setSent('Report sent. You will see the reply here.');
              }}>
                <div className="field"><label htmlFor="cat">Type</label>
                  <select id="cat" className="input" value={issue.category} onChange={(e) => setIssue({ ...issue, category: e.target.value })}>
                    {['Machine fault', 'Site hazard', 'Near miss', 'PPE or equipment', 'Task blocked', 'Working hours', 'Other complaint'].map((c) => <option key={c}>{c}</option>)}
                  </select></div>
                <div className="field"><label htmlFor="sev">Severity</label>
                  <select id="sev" className="input" value={issue.severity} onChange={(e) => setIssue({ ...issue, severity: e.target.value })}>
                    {['Low', 'Medium', 'High'].map((c) => <option key={c}>{c}</option>)}
                  </select></div>
                <div className="field full"><label htmlFor="txt">What happened?</label>
                  <textarea id="txt" className="input" value={issue.text} onChange={(e) => setIssue({ ...issue, text: e.target.value })} placeholder="Where, what you saw, and whether anyone is at risk" /></div>
                <div className="full row"><button className="btn primary">Send report</button>{sent && <span className="small muted">{sent}</span>}</div>
              </form>
            </Panel>
            <Panel title="Hours this week" sub={`${weekTotal.toFixed(1)} h worked. ${weekTotal > 48 ? 'Over the 48 h weekly limit.' : `${(48 - weekTotal).toFixed(1)} h below the 48 h weekly limit.`}`}>
              <div style={{ height: 210 }}>
                <ResponsiveContainer>
                  <BarChart data={week} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                    <CartesianGrid {...grid} /><XAxis dataKey="day" {...axis} /><YAxis {...axis} />
                    <Tooltip content={<ChartTip unit=" h" />} cursor={{ fill: '#F2F3EE' }} />
                    <ReferenceLine y={8} stroke="#777C71" strokeDasharray="4 3" label={{ value: '8 h', fontSize: 11, fill: '#777C71', position: 'right' }} />
                    <Bar dataKey="hours" name="Hours" radius={[3, 3, 0, 0]}>{week.map((d) => <Cell key={d.day} fill={d.hours > 9 ? '#C77700' : '#262822'} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>
          <Panel title="My reports">
            {myIssues.length ? (
              <div className="list">{myIssues.map((i) => (
                <div className="item" key={i.id}>
                  <div style={{ flex: 1 }}>
                    <div className="row"><strong>{i.category}</strong><Badge tone={i.severity === 'High' ? 'danger' : i.severity === 'Medium' ? 'warn' : 'info'}>{i.severity}</Badge><Badge tone={i.status === 'resolved' ? 'ok' : i.status === 'acknowledged' ? 'info' : 'neutral'}>{i.status}</Badge><span className="small muted">{fmtAgo(i.ts)}</span></div>
                    <p style={{ marginTop: 4 }}>{i.text}</p>
                    {i.replies.map((r) => <p key={r.ts} className="small" style={{ marginTop: 6, paddingLeft: 10, borderLeft: '3px solid var(--paint)' }}><strong>Supervisor:</strong> {r.text}</p>)}
                  </div>
                </div>
              ))}</div>
            ) : <Empty>You have not reported anything yet.</Empty>}
          </Panel>
        </>
      )}

      {tab === 'learn' && <LearningHub operator={op.id} op={op} machine={m} gamification={g} assigned={myTraining} risk={radar.top?.risk ?? 0} />}

      {sosOpen && (() => {
        const s = site.sos.find((x) => x.id === sosOpen);
        if (!s) return null;
        const proc = { Fire: 'Shut down the engine. Use the extinguisher only if it is small and you have a clear exit. Move upwind.', 'Machine rollover': 'Stay in the seat with the belt on. Do not jump. Wait for the machine to stop moving.', 'Hydraulic burst': 'Lower the attachment, shut down, keep away from spraying oil. It can pierce skin.', Injury: 'Make the area safe. Do not move the injured person unless there is danger.', 'Gas or dust': 'Move upwind and uphill. Cover your nose and mouth.' }[s.type] ?? 'Stay calm. Stay where you are if it is safe. Help has been alerted with your location.';
        return (
          <Modal title="SOS sent" onClose={() => setSosOpen(null)} width={620}>
            <div className="stack">
              <p>Your supervisor has your location and machine state. Machines within 30 m were sent a stop signal.</p>
              <div className="field"><label>What kind of emergency? (optional, helps responders)</label>
                <div className="row">{SOS_TYPES.map((t) => <button key={t} className={`btn sm ${s.type === t ? 'danger' : ''}`} onClick={() => actions.updateSOS(s.id, s.status, `Type set to ${t}`, op.id, { type: t })}>{t}</button>)}</div>
              </div>
              <div className="panel" style={{ background: 'var(--danger-soft)', borderColor: '#E9A89C' }}><h3>What to do now</h3><p style={{ marginTop: 6 }}>{proc}</p></div>
              <h3>Timeline</h3>
              <ul className="briefing">{s.timeline.map((t) => <li key={t.ts + t.text}><span className="small muted">{fmtTime(t.ts)}</span> {t.text}</li>)}</ul>
              <div className="row"><button className="btn" onClick={() => { actions.updateSOS(s.id, 'resolved', 'Cancelled by worker: false alarm', op.id); setSosOpen(null); }}>Cancel: false alarm</button></div>
            </div>
          </Modal>
        );
      })()}

      <Copilot ctx={{ role: 'operator', machine: m, tel, tasks: myTasks.map((t) => ({ ...t, predicted: predict(t) })), weather: site.weather, health: health.score, replans: site.replans, model, op }}
        suggestions={['What tasks are left?', 'How is my machine?', 'Is it safe to dig in zone B?', 'Hydraulic leak']} />
      <Toasts events={site.events}
        filter={(e) => e.source !== op.id && (e.payload?.operator === op.id || e.payload?.machine === m.id || ['broadcast', 'plan.updated', 'drill.started', 'sos.raised', 'weather.update', 'issue.updated'].includes(e.type))}
        describe={(e) => ({
          'task.assigned': () => ({ title: 'New task assigned', text: `${e.payload.type} on ${e.payload.machine}` }),
          'broadcast': () => ({ title: 'Message from supervisor', text: site.broadcasts[0]?.text?.slice(0, 120) }),
          'plan.updated': () => ({ title: 'Your plan changed', text: e.payload.reasons?.[0] }),
          'drill.started': () => ({ title: 'Emergency drill', text: 'Walk to the muster point and confirm in the app.', critical: true }),
          'sos.raised': () => ({ title: 'Site emergency', text: `${e.payload.type} near ${e.payload.machine}`, critical: true }),
          'sos.updated': () => (e.payload.status === 'acknowledged' ? { title: 'Help is coming', text: 'Supervisor acknowledged your SOS.', critical: true } : {}),
          'issue.updated': () => (myIssues.some((i) => i.id === e.payload.id) ? { title: 'Reply to your report', text: `Status: ${e.payload.status}` } : {}),
          'training.assigned': () => ({ title: 'Training assigned', text: 'Open Learn to start.' }),
          'weather.update': () => (e.source === 'SUP-01' ? { title: 'Weather update', text: `${e.payload.condition}, ${e.payload.temp}°C` } : {}),
        }[e.type]?.() ?? {})} />
    </Shell>
  );
}

// ---------------- machine history tab ----------------
function MachineHistory({ m, model, op, weather, data }) {
  const [range, setRange] = useState('12w');
  const weekly = range === '12w' ? m.weekly.slice(-12) : m.weekly;
  const pen = Object.entries(m.healthPenalty).map(([k, v]) => ({ k: { alerts: 'Safety alert rate', idle: 'Idling', fuel: 'Fuel per load cycle', service: 'Hours since service', seatbelt: 'Unbelted sessions' }[k], v }));
  const done = m.workDone.map((t) => ({ ...t, label: t.taskId.replace('T0', 'T'), over: Math.round((t.actual / t.est - 1) * 100) }));
  const avgFleetFpc = data.fleet.kpis.fuelPerCycle;
  return (
    <>
      <div className="grid g4">
        <Kpi value={n(m.sessions)} label="Work sessions logged" detail={`Last on ${m.lastSeen}`} />
        <Kpi value={n(m.cycles)} label="Load cycles completed" detail={`${(m.cycles / m.sessions).toFixed(1)} per session`} />
        <Kpi value={n(m.fuel)} unit="L" label="Fuel used" detail={`${m.fuelPerCycle.toFixed(3)} L per cycle (site ${avgFleetFpc.toFixed(3)})`} tone={m.fuelPerCycle > avgFleetFpc * 1.01 ? 'warn' : 'ok'} />
        <Kpi value={n(m.idleMin / 60)} unit="h" label="Idling" detail={`${m.avgIdle.toFixed(1)} min per session, ${n((m.idleMin / 60) * 3.2)} L of fuel`} />
      </div>
      <Panel title="Output and fuel by week" sub="Bars: load cycles. Line: fuel used (L)." action={<Seg label="Range" value={range} onChange={setRange} options={[{ value: '12w', label: 'Last 12 weeks' }, { value: 'all', label: 'Full year' }]} />}>
        <div style={{ height: 280 }}>
          <ResponsiveContainer>
            <ComposedChart data={weekly} margin={{ top: 6, right: 6, left: -10, bottom: 0 }}>
              <CartesianGrid {...grid} /><XAxis dataKey="week" {...axis} minTickGap={16} /><YAxis yAxisId="l" {...axis} /><YAxis yAxisId="r" orientation="right" {...axis} />
              <Tooltip content={<ChartTip />} cursor={{ fill: '#F2F3EE' }} /><Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="l" dataKey="cycles" name="Load cycles" fill={TYPE_META[m.type].color} radius={[3, 3, 0, 0]} />
              <Line yAxisId="r" dataKey="fuel" name="Fuel (L)" stroke="#262822" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <div className="grid g2">
        <Panel title="Safety alerts by month" sub={`${m.alerts} alerts in ${n(m.sessions)} sessions (${(m.alertRate * 100).toFixed(1)}%). ${m.unbelted} sessions ran without a fastened seatbelt.`}>
          <div style={{ height: 230 }}>
            <ResponsiveContainer>
              <BarChart data={m.monthly} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
                <CartesianGrid {...grid} /><XAxis dataKey="month" {...axis} /><YAxis {...axis} allowDecimals={false} />
                <Tooltip content={<ChartTip />} cursor={{ fill: '#F2F3EE' }} />
                <Bar dataKey="alert" name="Safety alerts" fill="#C2361F" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Why the health score is what it is" sub={`Health ${m.health}/100. Each bar is points lost against the best machine in the fleet.`}>
          <div className="stack" style={{ gap: 12 }}>
            {pen.map((p) => (
              <div key={p.k}>
                <div className="row between small"><span>{p.k}</span><strong>-{p.v.toFixed(1)}</strong></div>
                <Meter value={p.v} max={15} color={p.v > 10 ? 'var(--danger)' : p.v > 5 ? 'var(--warn)' : 'var(--ok)'} label={p.k} />
              </div>
            ))}
            <p className="small muted">Next 500-hour service in {m.serviceDueIn} engine hours, about {daysToService(m)} days at current use.</p>
          </div>
        </Panel>
      </div>
      <div className="grid g2">
        <Panel title="Recent jobs: planned vs actual" sub="Completed tasks on this machine. Most jobs on this site overrun their plan.">
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={done} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid {...grid} /><XAxis dataKey="label" {...axis} /><YAxis {...axis} />
                <Tooltip content={<ChartTip unit=" min" />} cursor={{ fill: '#F2F3EE' }} /><Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="est" name="Planned" fill="#B9BDB2" radius={[3, 3, 0, 0]} />
                <Bar dataKey="actual" name="Actual" fill="#262822" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="table-wrap"><table className="t">
            <thead><tr><th>Task</th><th>Type</th><th>Weather</th><th>Operator</th><th className="r">Overrun</th></tr></thead>
            <tbody>{done.map((t) => <tr key={t.taskId}><td>{t.taskId}</td><td>{t.type}</td><td>{t.weather}</td><td>{t.skill}</td><td className="r" style={{ color: t.over > 20 ? 'var(--danger)' : 'inherit' }}>{t.over > 0 ? '+' : ''}{t.over}%</td></tr>)}</tbody>
          </table></div>
        </Panel>
        <Panel title="Who ran this machine" sub="Operators with the most sessions on it this year.">
          <table className="t">
            <thead><tr><th>Operator</th><th className="r">Sessions</th><th className="r">Cycles</th><th className="r">Fuel</th><th className="r">Alerts</th></tr></thead>
            <tbody>{m.operators.map((o) => <tr key={o.id} style={o.id === op.id ? { background: 'var(--paint-soft)' } : undefined}><td>{o.id} <span className="muted small">{data.opById[o.id]?.name}</span></td><td className="r">{o.sessions}</td><td className="r">{o.cycles}</td><td className="r">{o.fuel} L</td><td className="r">{o.alerts}</td></tr>)}</tbody>
          </table>
          <h3 style={{ margin: '18px 0 8px' }}>Latest sessions</h3>
          <div className="table-wrap" style={{ maxHeight: 280, overflowY: 'auto' }}><table className="t">
            <thead><tr><th>Time</th><th>Operator</th><th className="r">Cycles</th><th className="r">Fuel</th><th className="r">Idle</th><th>Seatbelt</th></tr></thead>
            <tbody>{m.recent.map((r) => <tr key={r.ts + r.operator}><td className="small">{r.ts}</td><td>{r.operator}</td><td className="r">{r.cycles}</td><td className="r">{r.fuel} L</td><td className="r">{r.idle} min</td><td>{r.seatbelt === 'Fastened' ? <Badge tone="ok">Fastened</Badge> : <Badge tone="danger">Unfastened</Badge>}{r.alert ? <AlertTriangle size={13} color="#C2361F" style={{ marginLeft: 6, verticalAlign: -2 }} /> : null}</td></tr>)}</tbody>
          </table></div>
        </Panel>
      </div>
    </>
  );
}
