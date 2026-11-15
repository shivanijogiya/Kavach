import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, ReferenceLine,
} from 'recharts';
import { Search, Wrench, Leaf, BookOpen } from 'lucide-react';
import { useData } from '../lib/data';
import { actions } from '../lib/store';
import { TYPE_META, DIESEL_CO2_KG_PER_L, DIESEL_PRICE_INR, IDLE_BURN_L_PER_H, TASK_TYPES, WEATHERS, SKILLS } from '../lib/config';
import { predictMinutes, predictionFactors, healthLabel, healthTone, daysToService, behaviourNotes, n } from '../lib/engines';
import { COURSES } from '../lib/courses';
import { Panel, Kpi, Badge, Meter, Seg, Modal, ChartTip, axis, grid } from '../components/ui';

const TYPES = ['EXC', 'DOZ', 'GRD', 'LOD'];

// ---------------- Fleet ----------------
export function Fleet() {
  const { fleet, machines, opById } = useData();
  const [metric, setMetric] = useState('fuel');
  const [type, setType] = useState('ALL');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('health');
  const [pick, setPick] = useState(null);
  const k = fleet.kpis;
  const idleL = k.idleHours * IDLE_BURN_L_PER_H;
  const list = machines
    .filter((m) => (type === 'ALL' || m.type === type) && m.id.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (sort === 'health' ? a.health - b.health : sort === 'service' ? a.serviceDueIn - b.serviceDueIn : b.alertRate - a.alertRate));
  const queue = [...machines].map((m) => ({ ...m, days: daysToService(m) })).sort((a, b) => a.days - b.days).slice(0, 8);
  const healthDist = [
    { band: 'Good (75+)', count: machines.filter((m) => m.health >= 75).length, fill: '#2E7D4F' },
    { band: 'Watch (60-74)', count: machines.filter((m) => m.health >= 60 && m.health < 75).length, fill: '#C77700' },
    { band: 'Service soon (<60)', count: machines.filter((m) => m.health < 60).length, fill: '#C2361F' },
  ];
  const metricLabel = { fuel: 'Fuel used (L)', cycles: 'Load cycles', alerts: 'Safety alerts', idleH: 'Idle hours' }[metric];
  const m = pick && machines.find((x) => x.id === pick);

  return (
    <>
      <div className="grid g4">
        <Kpi value={n(k.cycles)} label="Load cycles in the year" detail={`${k.from} to ${k.to}`} />
        <Kpi value={n(k.fuel)} unit="L" label="Fuel burned" detail={`${n(k.fuel * DIESEL_CO2_KG_PER_L / 1000)} t CO2`} />
        <Kpi value={`${(k.beltCompliance * 100).toFixed(1)}`} unit="%" label="Seatbelt compliance" tone="warn" detail="Target 100%" />
        <Kpi value={`${(k.alertRate * 100).toFixed(1)}`} unit="%" label="Sessions with a safety alert" detail={`${n(k.alerts)} alerts`} tone="danger" />
      </div>

      <Panel title="Fleet trend by machine type" sub="Monthly totals from 100,000 telemetry sessions." action={<Seg label="Metric" value={metric} onChange={setMetric} options={[{ value: 'fuel', label: 'Fuel' }, { value: 'cycles', label: 'Load cycles' }, { value: 'idleH', label: 'Idle hours' }, { value: 'alerts', label: 'Alerts' }]} />}>
        <div style={{ height: 290 }}>
          <ResponsiveContainer>
            <LineChart data={fleet.monthly} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid {...grid} /><XAxis dataKey="month" {...axis} /><YAxis {...axis} tickFormatter={(v) => n(v)} width={56} />
              <Tooltip content={<ChartTip />} /><Legend wrapperStyle={{ fontSize: 12 }} />
              {TYPES.map((t) => <Line key={t} dataKey={`${t}_${metric}`} name={TYPE_META[t].label} stroke={TYPE_META[t].color} strokeWidth={2.2} dot={{ r: 2.5 }} />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="small muted">Showing {metricLabel.toLowerCase()}. All four fleets run at similar intensity, so gains will come from behaviour, not fleet mix.</p>
      </Panel>

      <div className="grid g3">
        <Panel title="The seatbelt effect" sub="Share of sessions that triggered a safety alert.">
          <div style={{ height: 210 }}>
            <ResponsiveContainer>
              <BarChart data={[{ s: 'Fastened', v: fleet.seatbeltAlert.fastened }, { s: 'Unfastened', v: fleet.seatbeltAlert.unfastened }]} margin={{ top: 16, right: 6, left: -20, bottom: 0 }}>
                <CartesianGrid {...grid} /><XAxis dataKey="s" {...axis} /><YAxis {...axis} unit="%" domain={[0, 100]} />
                <Tooltip content={<ChartTip unit="%" />} cursor={{ fill: '#F2F3EE' }} />
                <Bar dataKey="v" name="Alert rate" radius={[3, 3, 0, 0]} label={{ position: 'top', fontSize: 12, formatter: (v) => `${v}%` }}>
                  <Cell fill="#2E7D4F" /><Cell fill="#C2361F" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="small"><strong>{fleet.seatbeltAlert.shareOfAlertsUnbelted}% of all alerts</strong> come from unbelted sessions. A cab interlock that blocks hydraulics until the belt is latched would remove most of them.</p>
        </Panel>
        <Panel title="Alerts by hour of day" sub="Alert rate (%) per hour, 24-hour operation.">
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={fleet.hourly} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
                <CartesianGrid {...grid} /><XAxis dataKey="hour" {...axis} interval={2} /><YAxis {...axis} domain={[11, 14]} />
                <Tooltip content={<ChartTip unit="%" />} cursor={{ fill: '#F2F3EE' }} />
                <Bar dataKey="rate" name="Alert rate" radius={[2, 2, 0, 0]}>{fleet.hourly.map((h) => <Cell key={h.hour} fill={h.rate > 13 ? '#C2361F' : '#B9BDB2'} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Fleet health" sub="Machines by health band right now.">
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={healthDist} layout="vertical" margin={{ top: 6, right: 24, left: 20, bottom: 0 }}>
                <CartesianGrid stroke="#E7E8E2" horizontal={false} /><XAxis type="number" {...axis} /><YAxis type="category" dataKey="band" {...axis} width={110} />
                <Tooltip content={<ChartTip />} cursor={{ fill: '#F2F3EE' }} />
                <Bar dataKey="count" name="Machines" radius={[0, 3, 3, 0]} label={{ position: 'right', fontSize: 12 }}>{healthDist.map((d) => <Cell key={d.band} fill={d.fill} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid g-7-5">
        <Panel title="Idle cost ledger" sub="What idling cost this site over the year, and what a 25% cut would return.">
          <div className="grid g3" style={{ gap: 10 }}>
            <Kpi value={n(k.idleHours)} unit="h" label="Engine idle time" />
            <Kpi value={n(idleL)} unit="L" label="Diesel burned idling" detail={`at ${IDLE_BURN_L_PER_H} L/h`} />
            <Kpi value={`₹${n(idleL * DIESEL_PRICE_INR / 100000, 1)}`} unit="lakh" label="Cost of idling" detail={`${n(idleL * DIESEL_CO2_KG_PER_L / 1000)} t CO2`} tone="warn" />
          </div>
          <div className="row" style={{ marginTop: 14, background: 'var(--ok-soft)', padding: '10px 12px', borderRadius: 4 }}>
            <Leaf size={18} color="#2E7D4F" />
            <p className="small">Auto engine-off after 5 minutes of idle and operator coaching on the worst idlers could cut idle by a quarter: <strong>₹{n(idleL * 0.25 * DIESEL_PRICE_INR / 100000, 1)} lakh and {n(idleL * 0.25 * DIESEL_CO2_KG_PER_L / 1000)} t CO2 a year.</strong></p>
          </div>
          <div style={{ height: 200, marginTop: 14 }}>
            <ResponsiveContainer>
              <BarChart data={fleet.byType.map((t) => ({ ...t, label: TYPE_META[t.type].label, cost: (t.idleHours * IDLE_BURN_L_PER_H * DIESEL_PRICE_INR) / 100000 }))} margin={{ top: 6, right: 6, left: -10, bottom: 0 }}>
                <CartesianGrid {...grid} /><XAxis dataKey="label" {...axis} /><YAxis {...axis} />
                <Tooltip content={<ChartTip fmt={(v) => `₹${v.toFixed(1)} lakh`} />} cursor={{ fill: '#F2F3EE' }} />
                <Bar dataKey="cost" name="Idle cost" radius={[3, 3, 0, 0]}>{fleet.byType.map((t) => <Cell key={t.type} fill={TYPE_META[t.type].color} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Predictive maintenance" sub="Next 500-hour service at each machine's usage rate. Soonest first.">
          <div className="list">
            {queue.map((q) => (
              <div className="item" key={q.id} style={{ cursor: 'pointer' }} onClick={() => setPick(q.id)}>
                <div className="icon" style={{ background: q.days <= 7 ? 'var(--danger-soft)' : 'var(--warn-soft)', color: q.days <= 7 ? 'var(--danger)' : 'var(--warn)' }}><Wrench size={15} /></div>
                <div style={{ flex: 1 }}>
                  <div className="row between"><strong>{q.id}</strong><span className="small">{q.days <= 0 ? 'Due now' : `in ${q.days} days`}</span></div>
                  <div className="small muted">{q.model}, {q.serviceDueIn} h left, health {q.health}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="All machines" sub="Click a machine for its history."
        action={<div className="row">
          <div style={{ position: 'relative' }}><Search size={14} style={{ position: 'absolute', left: 8, top: 10, color: '#777C71' }} /><input className="input" style={{ paddingLeft: 26, width: 150 }} placeholder="Find ID" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find machine" /></div>
          <Seg label="Type" value={type} onChange={setType} options={['ALL', ...TYPES].map((t) => ({ value: t, label: t === 'ALL' ? 'All' : t }))} />
          <select className="input" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
            <option value="health">Lowest health</option><option value="service">Service soonest</option><option value="alerts">Most alerts</option>
          </select>
        </div>}>
        <div className="table-wrap" style={{ maxHeight: 460, overflowY: 'auto' }}>
          <table className="t">
            <thead><tr><th>Machine</th><th>Model</th><th>Health</th><th className="r">Engine h</th><th className="r">Service in</th><th className="r">Sessions</th><th className="r">Fuel / cycle</th><th className="r">Alert rate</th><th className="r">Unbelted</th><th>Last operator</th></tr></thead>
            <tbody>{list.map((x) => (
              <tr key={x.id} className="clickable" onClick={() => setPick(x.id)}>
                <td><strong>{x.id}</strong></td><td>{x.model}</td>
                <td style={{ minWidth: 130 }}><div className="row" style={{ gap: 6 }}><span className="num" style={{ width: 22 }}>{x.health}</span><div style={{ flex: 1 }}><Meter value={x.health} color={`var(--${healthTone(x.health)})`} label="Health" /></div></div></td>
                <td className="r">{n(x.engineHours)}</td><td className="r">{n(x.serviceDueIn)} h</td><td className="r">{x.sessions}</td>
                <td className="r">{x.fuelPerCycle.toFixed(3)}</td><td className="r">{(x.alertRate * 100).toFixed(1)}%</td><td className="r">{(x.unbeltedRate * 100).toFixed(1)}%</td>
                <td>{x.lastOperator}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Panel>

      {m && (
        <Modal title={`${m.id}: ${m.model} ${m.typeName}`} onClose={() => setPick(null)}>
          <div className="grid g4" style={{ marginBottom: 16 }}>
            <Kpi value={m.health} unit="/100" label={`Health: ${healthLabel(m.health)}`} tone={healthTone(m.health)} />
            <Kpi value={n(m.cycles)} label="Load cycles" />
            <Kpi value={n(m.fuel)} unit="L" label="Fuel" />
            <Kpi value={m.alerts} label="Safety alerts" />
          </div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <ComposedChart data={m.weekly} margin={{ top: 6, right: 6, left: -10, bottom: 0 }}>
                <CartesianGrid {...grid} /><XAxis dataKey="week" {...axis} minTickGap={20} /><YAxis yAxisId="l" {...axis} /><YAxis yAxisId="r" orientation="right" {...axis} />
                <Tooltip content={<ChartTip />} /><Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="l" dataKey="cycles" name="Load cycles" fill={TYPE_META[m.type].color} />
                <Line yAxisId="r" dataKey="alert" name="Alerts" stroke="#C2361F" dot={false} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <h3 style={{ margin: '16px 0 8px' }}>Top operators on this machine</h3>
          <table className="t"><thead><tr><th>Operator</th><th className="r">Sessions</th><th className="r">Cycles</th><th className="r">Alerts</th></tr></thead>
            <tbody>{m.operators.map((o) => <tr key={o.id}><td>{o.id} <span className="small muted">{opById[o.id]?.name}</span></td><td className="r">{o.sessions}</td><td className="r">{o.cycles}</td><td className="r">{o.alerts}</td></tr>)}</tbody></table>
        </Modal>
      )}
    </>
  );
}

// ---------------- Crew ----------------
export function Crew({ site }) {
  const { operators, fleetAvg } = useData();
  const [sort, setSort] = useState('score');
  const [pick, setPick] = useState(null);
  const today = new Date().setHours(0, 0, 0, 0);
  const weekStart = today - 6 * 86400000;
  const hoursOf = (id) => site.timesheets.filter((t) => t.operator === id && t.in >= weekStart)
    .reduce((a, t) => a + ((t.out ?? Date.now()) - t.in) / 3600000 - (t.breaks ?? 0) / 60, 0);
  const onShift = new Set(site.timesheets.filter((t) => !t.out).map((t) => t.operator));
  const rows = operators.map((o) => ({ ...o, week: hoursOf(o.id), on: onShift.has(o.id) }))
    .sort((a, b) => (sort === 'score' ? a.score - b.score : sort === 'hours' ? b.week - a.week : b.alertRate - a.alertRate));
  const hoursChart = operators.map((o) => ({ id: o.id, hours: +hoursOf(o.id).toFixed(1) })).filter((x) => x.hours > 0).sort((a, b) => b.hours - a.hours);
  const scoreBands = [0, 40, 50, 60, 70, 80, 90].map((lo, i, arr) => ({ band: `${lo}-${arr[i + 1] ?? 100}`, count: operators.filter((o) => o.score >= lo && o.score < (arr[i + 1] ?? 101)).length }));
  const p = pick && operators.find((o) => o.id === pick);

  return (
    <>
      <div className="grid g4">
        <Kpi value={onShift.size} label="On shift now" />
        <Kpi value={operators.length} label="Operators on the roster" />
        <Kpi value={operators.filter((o) => o.score < 50).length} label="Need coaching (score under 50)" tone="warn" />
        <Kpi value={n(hoursChart.reduce((a, h) => a + h.hours, 0), 1)} unit="h" label="Hours logged, last 7 days" />
      </div>
      <div className="grid g2">
        <Panel title="Hours worked, last 7 days" sub="From shift check-ins. The dashed line is the 48 h weekly limit.">
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={hoursChart} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid {...grid} /><XAxis dataKey="id" {...axis} /><YAxis {...axis} />
                <Tooltip content={<ChartTip unit=" h" />} cursor={{ fill: '#F2F3EE' }} />
                <ReferenceLine y={48} stroke="#C2361F" strokeDasharray="4 3" />
                <Bar dataKey="hours" name="Hours" radius={[3, 3, 0, 0]}>{hoursChart.map((h) => <Cell key={h.id} fill={h.hours > 48 ? '#C2361F' : '#262822'} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Behaviour score distribution" sub="Score blends alert rate, seatbelt use, idling and fuel per cycle.">
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={scoreBands} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid {...grid} /><XAxis dataKey="band" {...axis} /><YAxis {...axis} allowDecimals={false} />
                <Tooltip content={<ChartTip />} cursor={{ fill: '#F2F3EE' }} />
                <Bar dataKey="count" name="Operators" radius={[3, 3, 0, 0]}>{scoreBands.map((b, i) => <Cell key={b.band} fill={i < 2 ? '#C2361F' : i < 4 ? '#C77700' : '#2E7D4F'} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
      <Panel title="Crew" sub="Click an operator to assign training." action={<Seg label="Sort" value={sort} onChange={setSort} options={[{ value: 'score', label: 'Lowest score' }, { value: 'alerts', label: 'Most alerts' }, { value: 'hours', label: 'Most hours' }]} />}>
        <div className="table-wrap" style={{ maxHeight: 480, overflowY: 'auto' }}>
          <table className="t">
            <thead><tr><th>Operator</th><th>Skill</th><th>Status</th><th className="r">Score</th><th className="r">Alert rate</th><th className="r">Unbelted</th><th className="r">Idle / session</th><th className="r">Hours (7 d)</th><th>Coaching note</th></tr></thead>
            <tbody>{rows.map((o) => (
              <tr key={o.id} className="clickable" onClick={() => setPick(o.id)}>
                <td><strong>{o.id}</strong> <span className="small muted">{o.name}</span></td><td>{o.skill}</td>
                <td>{o.on ? <Badge tone="ok">On shift</Badge> : <Badge>Off</Badge>}</td>
                <td className="r"><Badge tone={o.score >= 70 ? 'ok' : o.score >= 50 ? 'warn' : 'danger'}>{o.score}</Badge></td>
                <td className="r">{(o.alertRate * 100).toFixed(1)}%</td><td className="r">{(o.unbeltedRate * 100).toFixed(1)}%</td>
                <td className="r">{o.avgIdle.toFixed(1)} min</td><td className="r">{o.week.toFixed(1)}</td>
                <td className="small">{behaviourNotes(o, fleetAvg)[0]}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Panel>
      {p && (
        <Modal title={`${p.name} (${p.id})`} onClose={() => setPick(null)} width={640}>
          <div className="grid g3" style={{ marginBottom: 14 }}>
            <Kpi value={p.score} unit="/100" label="Behaviour score" tone={p.score >= 70 ? 'ok' : p.score >= 50 ? 'warn' : 'danger'} />
            <Kpi value={n(p.sessions)} label="Sessions" />
            <Kpi value={p.machines} label="Machines operated" />
          </div>
          <ul className="briefing">{behaviourNotes(p, fleetAvg).map((x) => <li key={x}>{x}</li>)}</ul>
          <h3 style={{ margin: '14px 0 8px' }}>Assign training</h3>
          <div className="list">{COURSES.map((c) => {
            const assigned = site.training.find((t) => t.operator === p.id && t.courseId === c.id);
            const best = site.gamification[p.id]?.quizzes?.[c.id];
            return (
              <div className="item" key={c.id}>
                <div className="icon" style={{ background: 'var(--info-soft)', color: 'var(--info)' }}><BookOpen size={15} /></div>
                <div style={{ flex: 1 }}><strong>{c.title}</strong><div className="small muted">{best !== undefined ? `Best quiz score ${best}/5` : 'Not attempted'}</div></div>
                {assigned ? <Badge tone={assigned.done ? 'ok' : 'info'}>{assigned.done ? 'Completed' : 'Assigned'}</Badge>
                  : <button className="btn sm" onClick={() => actions.assignTraining(p.id, c.id, behaviourNotes(p, fleetAvg)[0])}>Assign</button>}
              </div>
            );
          })}</div>
        </Modal>
      )}
    </>
  );
}

// ---------------- Planner insights (task time model) ----------------
export function Planner() {
  const { tasks } = useData();
  const { model } = tasks;
  const [f, setF] = useState({ type: 'Trenching', weather: 'Rainy', skill: 'Beginner', age: 8, est: model.baseEstimate.Trenching });
  const p = predictMinutes(model, f);
  const factors = predictionFactors(model, f);
  const byAge = tasks.byAge.map((a) => ({ ...a, key: `${a.key} yr` }));
  const heat = (v) => (v > 60 ? '#C2361F' : v > 40 ? '#E07A5F' : v > 25 ? '#F2B880' : v > 10 ? '#F7DDB0' : '#DCEBDD');
  return (
    <>
      <div className="grid g4">
        <Kpi value={n(model.n)} label="Past tasks analysed" />
        <Kpi value={`+${(tasks.byType.reduce((a, t) => a + t.overrunPct * t.n, 0) / model.n).toFixed(0)}`} unit="%" label="Average overrun vs plan" tone="warn" />
        <Kpi value={model.maePlanned.toFixed(1)} unit="min" label="Planner error today" detail="Mean absolute error of planned times" tone="danger" />
        <Kpi value={model.maeModel.toFixed(1)} unit="min" label="Error with SiteSense model" detail={`${model.improvementPct}% more accurate`} tone="ok" />
      </div>
      <div className="grid g-7-5">
        <Panel title="Task time predictor" sub="Change the conditions. The model multiplies the planned time by factors learned from past tasks.">
          <div className="form-grid">
            <div className="field"><label>Task type</label><select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value, est: model.baseEstimate[e.target.value] })}>{TASK_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div className="field"><label>Planned minutes</label><input className="input" type="number" min="5" value={f.est} onChange={(e) => setF({ ...f, est: +e.target.value || 0 })} /></div>
            <div className="field"><label>Weather</label><select className="input" value={f.weather} onChange={(e) => setF({ ...f, weather: e.target.value })}>{WEATHERS.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div className="field"><label>Operator skill</label><select className="input" value={f.skill} onChange={(e) => setF({ ...f, skill: e.target.value })}>{SKILLS.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div className="field full"><label>Machine age: {f.age} years</label><input type="range" min="1" max="10" value={f.age} onChange={(e) => setF({ ...f, age: +e.target.value })} /></div>
          </div>
          <div className="row" style={{ marginTop: 16, gap: 24, alignItems: 'flex-end' }}>
            <div><div className="small muted">Planned</div><div style={{ font: '600 32px var(--display)' }}>{f.est} min</div></div>
            <div><div className="small muted">Predicted</div><div style={{ font: '700 44px/1 var(--display)', color: p > f.est * 1.2 ? 'var(--danger)' : 'var(--ink)' }}>{p} min</div></div>
            <Badge tone={p > f.est ? 'danger' : 'ok'}>{p > f.est ? '+' : ''}{Math.round((p / f.est - 1) * 100)}%</Badge>
          </div>
          <div className="stack" style={{ marginTop: 14, gap: 8 }}>
            {factors.map((x) => (
              <div key={x.label} className="row between small"><span>{x.label}</span><strong style={{ color: x.pct > 0 ? 'var(--danger)' : 'var(--ok)' }}>{x.pct > 0 ? '+' : ''}{x.pct.toFixed(1)}%</strong></div>
            ))}
          </div>
        </Panel>
        <Panel title="Overrun by weather and skill" sub="Average % over plan. Darker is worse.">
          <div className="table-wrap"><table className="t">
            <thead><tr><th>Weather</th>{SKILLS.map((s) => <th key={s} className="r">{s}</th>)}</tr></thead>
            <tbody>{tasks.weatherSkill.map((r) => (
              <tr key={r.weather}><td>{r.weather}</td>{SKILLS.map((s) => <td key={s} className="r" style={{ background: heat(r[s]), fontWeight: 600 }}>{r[s] > 0 ? '+' : ''}{r[s]}%</td>)}</tr>
            ))}</tbody>
          </table></div>
          <p className="small muted" style={{ marginTop: 10 }}>A beginner in snow finishes {tasks.weatherSkill.find((w) => w.weather === 'Snowy')?.Beginner}% over plan; an expert in sunshine finishes within {Math.abs(tasks.weatherSkill.find((w) => w.weather === 'Sunny')?.Expert)}% of it. Give beginners fair-weather tasks and plan buffers for rain.</p>
        </Panel>
      </div>
      <div className="grid g3">
        <Panel title="Planned vs actual by weather" sub="Average minutes per task.">
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={tasks.byWeather} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
                <CartesianGrid {...grid} /><XAxis dataKey="key" {...axis} /><YAxis {...axis} />
                <Tooltip content={<ChartTip unit=" min" />} cursor={{ fill: '#F2F3EE' }} /><Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="est" name="Planned" fill="#B9BDB2" radius={[3, 3, 0, 0]} /><Bar dataKey="actual" name="Actual" fill="#2F6690" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Overrun by machine age" sub="Older machines run steadily later.">
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={byAge} margin={{ top: 6, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid {...grid} /><XAxis dataKey="key" {...axis} /><YAxis {...axis} unit="%" domain={[10, 30]} />
                <Tooltip content={<ChartTip unit="%" />} /><Line dataKey="overrunPct" name="Overrun" stroke="#C77700" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="How late tasks finish" sub="Count of the 100,000 tasks by % over plan (band start).">
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={tasks.overrunDist.map((d, i) => ({ ...d, b: ['<-10', '-10', '0', '10', '20', '30', '50', '75', '100+'][i] }))} margin={{ top: 6, right: 6, left: -8, bottom: 0 }}>
                <CartesianGrid {...grid} /><XAxis dataKey="b" {...axis} interval={0} tick={{ fontSize: 10.5, fill: '#777C71' }} /><YAxis {...axis} tickFormatter={(v) => n(v)} />
                <Tooltip content={<ChartTip />} cursor={{ fill: '#F2F3EE' }} />
                <Bar dataKey="count" name="Tasks" radius={[3, 3, 0, 0]}>{tasks.overrunDist.map((d) => <Cell key={d.bucket} fill={d.bucket.startsWith('Early') ? '#2E7D4F' : '#262822'} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
      <Panel title="By task type">
        <div className="table-wrap"><table className="t">
          <thead><tr><th>Task type</th><th className="r">Tasks</th><th className="r">Avg planned</th><th className="r">Avg actual</th><th className="r">Overrun</th></tr></thead>
          <tbody>{tasks.byType.map((t) => <tr key={t.key}><td>{t.key}</td><td className="r">{n(t.n)}</td><td className="r">{t.est} min</td><td className="r">{t.actual} min</td><td className="r">+{t.overrunPct}%</td></tr>)}</tbody>
        </table></div>
      </Panel>
    </>
  );
}
