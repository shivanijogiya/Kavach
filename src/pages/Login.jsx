import { useState } from 'react';
import { HardHat, ClipboardList } from 'lucide-react';
import { useData } from '../lib/data';
import { SUPERVISOR } from '../lib/config';
import { n } from '../lib/engines';

export default function Login({ onLogin }) {
  const { machines, operators, fleet, machineById, opById } = useData();
  const [role, setRole] = useState('operator');
  const [op, setOp] = useState('OP1001');
  const [mid, setMid] = useState('');
  const [sup, setSup] = useState(SUPERVISOR.id);
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (role === 'operator') {
      const id = mid.trim().toUpperCase();
      if (!opById[op]) return setErr('Choose your operator ID from the list.');
      if (!machineById[id]) return setErr(`No machine "${mid || '(empty)'}" on this site. Machine IDs look like EXC001, DOZ014, GRD007 or LOD022.`);
      onLogin({ role: 'operator', operator: op, machine: id });
    } else {
      if (sup !== SUPERVISOR.id || pin !== SUPERVISOR.pin) return setErr('Supervisor ID or PIN is wrong. Demo: SUP-01 with PIN 1234.');
      onLogin({ role: 'supervisor', id: sup });
    }
  };

  const m = machineById[mid.trim().toUpperCase()];
  return (
    <div className="login">
      <section className="login-hero">
        <div>
          <div className="row" style={{ gap: 10 }}>
            <div className="brand-mark"><svg width="20" height="20" viewBox="0 0 32 32"><path d="M3 25 L13 9 L18 17 L22 12 L29 25 Z" fill="#262822" /></svg></div>
            <span style={{ font: '700 22px var(--display)' }}>SiteSense</span>
          </div>
        </div>
        <div>
          <h1>Every machine and every person on one live site.</h1>
          <p className="lead">Operators see what their machine did, what is left and how healthy it is. Supervisors see the whole site, assign work and respond to issues as they happen.</p>
          <div className="facts">
            <div>{n(fleet.kpis.sessions)}<span>machine sessions analysed</span></div>
            <div>{fleet.seatbeltAlert.unfastened}%<span>of unbelted sessions end in a safety alert</span></div>
            <div>{machines.length}<span>machines across 4 fleets</span></div>
          </div>
        </div>
        <p style={{ fontSize: 12.5, color: '#8d9285' }}>Telemetry {fleet.kpis.from} to {fleet.kpis.to}. Live signals come from the built-in site simulator.</p>
        <div className="login-stripe" />
      </section>

      <form className="login-form" onSubmit={submit}>
        <div>
          <h1 style={{ fontSize: 34 }}>Sign in</h1>
          <p className="muted" style={{ marginTop: 6 }}>Choose how you work on site today.</p>
        </div>
        <div className="role-pick">
          <button type="button" aria-pressed={role === 'operator'} onClick={() => { setRole('operator'); setErr(''); }}>
            <HardHat size={22} /><strong>Operator or worker</strong><span>Your machine, tasks, safety and training</span>
          </button>
          <button type="button" aria-pressed={role === 'supervisor'} onClick={() => { setRole('supervisor'); setErr(''); }}>
            <ClipboardList size={22} /><strong>Supervisor</strong><span>Site map, fleet, crew, tasks and SOS</span>
          </button>
        </div>

        {role === 'operator' ? (
          <>
            <div className="field">
              <label htmlFor="op">Operator ID</label>
              <select id="op" className="input" value={op} onChange={(e) => setOp(e.target.value)}>
                {operators.map((o) => <option key={o.id} value={o.id}>{o.id} ({o.name})</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="mid">Machine ID</label>
              <input id="mid" className="input" list="machine-ids" value={mid} onChange={(e) => { setMid(e.target.value); setErr(''); }} placeholder="e.g. EXC001" autoComplete="off" style={{ textTransform: 'uppercase', font: '600 18px var(--display)', letterSpacing: '.04em' }} />
              <datalist id="machine-ids">{machines.map((x) => <option key={x.id} value={x.id}>{x.model} {x.typeName}</option>)}</datalist>
              <span className="small muted">{m ? `${m.model} ${m.typeName.toLowerCase()}, ${n(m.engineHours)} engine hours, last run by ${m.lastOperator}` : 'The ID is on the plate beside the cab door.'}</span>
            </div>
          </>
        ) : (
          <>
            <div className="field">
              <label htmlFor="sup">Supervisor ID</label>
              <input id="sup" className="input" value={sup} onChange={(e) => setSup(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="pin">PIN</label>
              <input id="pin" className="input" type="password" inputMode="numeric" value={pin} onChange={(e) => { setPin(e.target.value); setErr(''); }} placeholder="Demo PIN 1234" />
            </div>
          </>
        )}
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn paint" style={{ padding: '12px', fontSize: 15 }}>{role === 'operator' ? 'Start my shift view' : 'Open command center'}</button>
        <p className="small muted">Tip: sign in as the supervisor in a second browser tab. Tasks, issues and SOS alerts sync between tabs live.</p>
      </form>
    </div>
  );
}
