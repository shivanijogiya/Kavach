import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

export function Panel({ title, sub, action, children, className = '', style }) {
  return (
    <section className={`panel ${className}`} style={style}>
      {(title || action) && (
        <div className="panel-head">
          <div>
            {title && <h2>{title}</h2>}
            {sub && <p>{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ value, unit, label, detail, tone }) {
  return (
    <div className={`kpi ${tone ? `tone-${tone}` : ''}`}>
      <div className="v">{value}{unit && <small>{unit}</small>}</div>
      <div className="l">{label}</div>
      {detail && <div className="d">{detail}</div>}
    </div>
  );
}

export const Badge = ({ tone = 'neutral', children }) => <span className={`badge b-${tone}`}>{children}</span>;

export function Meter({ value, max = 100, color = 'var(--ok)', label }) {
  return (
    <div className="meter" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <span style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, background: color }} />
    </div>
  );
}

export function Seg({ options, value, onChange, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        return <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>;
      })}
    </div>
  );
}

export function Modal({ title, onClose, children, width }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} style={width ? { width } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2>{title}</h2>
          <button className="btn ghost sm" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const Empty = ({ children }) => <div className="empty">{children}</div>;

// Recharts tooltip in the house style
export function ChartTip({ active, payload, label, unit = '', fmt }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#262822', color: '#fff', padding: '8px 11px', borderRadius: 4, fontSize: 12.5, boxShadow: '0 6px 18px rgba(0,0,0,.2)' }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color || p.fill }} />
          <span style={{ opacity: 0.8 }}>{p.name}</span>
          <span style={{ marginLeft: 'auto', fontWeight: 700, paddingLeft: 10 }}>{fmt ? fmt(p.value) : Number(p.value).toLocaleString('en-IN', { maximumFractionDigits: 1 })}{unit}</span>
        </div>
      ))}
    </div>
  );
}
export const axis = { tick: { fontSize: 11.5, fill: '#777C71' }, axisLine: { stroke: '#D8DAD2' }, tickLine: false };
export const grid = { stroke: '#E7E8E2', vertical: false };

// Toasts for events addressed to the current user
export function Toasts({ events, filter, describe }) {
  const seen = useRef(null);
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (seen.current === null) { seen.current = new Set(events.map((e) => e.id)); return; }
    const fresh = events.filter((e) => !seen.current.has(e.id));
    fresh.forEach((e) => seen.current.add(e.id));
    const safe = (e) => { try { return describe(e) ?? {}; } catch { return {}; } };
    const shown = fresh.filter(filter).map((e) => ({ id: e.id, ...safe(e) })).filter((x) => x.title);
    if (!shown.length) return;
    setItems((cur) => [...shown, ...cur].slice(0, 4));
    shown.forEach((s) => setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== s.id)), s.critical ? 12000 : 6000));
  }, [events]);
  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.critical ? 'critical' : ''}`}><strong>{t.title}</strong>{t.text}</div>
      ))}
    </div>
  );
}

// Press-and-hold SOS (prevents accidental taps)
export function SOSButton({ onFire, holdMs = 2000 }) {
  const [p, setP] = useState(0);
  const timer = useRef(null);
  const start = () => {
    const t0 = Date.now();
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      const k = Math.min(1, (Date.now() - t0) / holdMs);
      setP(k);
      if (k >= 1) { clearInterval(timer.current); setP(0); onFire(); }
    }, 30);
  };
  const stop = () => { clearInterval(timer.current); setP(0); };
  return (
    <button className="sos-btn" onPointerDown={start} onPointerUp={stop} onPointerLeave={stop}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) start(); }} onKeyUp={stop}
      aria-label="SOS. Press and hold for 2 seconds">
      <span className="fill" style={{ transform: `scaleX(${p})` }} />
      <span>{p > 0 ? 'HOLD…' : 'SOS'}</span>
    </button>
  );
}
