import { SITE_W, SITE_H, SITE_ZONES, MUSTER } from '../lib/sim';
import { TYPE_META } from '../lib/config';

const ZONE_FILL = { safe: '#CFE3D3', warning: '#F6DFAE', danger: '#F2C1B6', critical: '#E48B7C' };
const ZONE_STROKE = { safe: '#5E9A6C', warning: '#C98A12', danger: '#C2361F', critical: '#8F2413' };
const WORKER = { safe: '#2E7D4F', warning: '#C77700', danger: '#C2361F', critical: '#7A1A0C' };

export default function SiteMap({ snap, highlight, onPick, compact }) {
  const { machines = [], workers = [], risks = [] } = snap;
  return (
    <div>
      <svg className="sitemap" viewBox={`0 0 ${SITE_W} ${SITE_H}`} role="img" aria-label="Live site map with zones, machines and workers">
        <defs>
          <pattern id="dirt" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="0.6" fill="#cbc6b6" /><circle cx="6" cy="5" r="0.5" fill="#d3cfc1" /></pattern>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="6" fill="rgba(143,36,19,.25)" /></pattern>
        </defs>
        <rect width={SITE_W} height={SITE_H} fill="url(#dirt)" />
        {SITE_ZONES.map((z) => (
          <g key={z.id}>
            <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="2" fill={ZONE_FILL[z.type]} stroke={ZONE_STROKE[z.type]} strokeWidth="0.8" strokeDasharray={z.type === 'warning' ? '3 2' : undefined} opacity="0.85" />
            {z.type === 'critical' && <rect x={z.x} y={z.y} width={z.w} height={z.h} fill="url(#hatch)" />}
            {!compact && <text x={z.x + 4} y={z.y + 9} fontSize="7" fontWeight="600" fill="#3a3d34">{z.short ?? z.name}</text>}
          </g>
        ))}
        <g>
          <circle cx={MUSTER.x} cy={MUSTER.y} r="6" fill="#2E7D4F" />
          <text x={MUSTER.x} y={MUSTER.y + 2.4} fontSize="6.5" fill="#fff" textAnchor="middle" fontWeight="700">M</text>
          <text x={MUSTER.x + 9} y={MUSTER.y + 2.5} fontSize="7" fill="#2E7D4F" fontWeight="600">Muster point</text>
        </g>
        {risks.map((r) => {
          const w = workers.find((x) => x.id === r.worker); const m = machines.find((x) => x.id === r.machine);
          if (!w || !m) return null;
          return <line key={`${r.worker}-${r.machine}`} x1={w.x} y1={w.y} x2={m.x} y2={m.y} stroke={r.level === 'critical' ? '#C2361F' : '#C77700'} strokeWidth="1" strokeDasharray="2 1.5" />;
        })}
        {machines.map((m) => {
          const meta = TYPE_META[m.type];
          const hl = highlight === m.id;
          return (
            <g key={m.id} onClick={() => onPick?.(m.id)} style={{ cursor: onPick ? 'pointer' : 'default' }}>
              {m.working && <circle cx={m.x} cy={m.y} r={meta.swing} fill="none" stroke={meta.color} strokeWidth="0.7" strokeDasharray="2 2" opacity="0.9" />}
              <g transform={`translate(${m.x} ${m.y}) rotate(${(m.heading * 180) / Math.PI})`}>
                <rect x="-5" y="-3.2" width="10" height="6.4" rx="1" fill={meta.color} stroke={hl ? '#262822' : '#fff'} strokeWidth={hl ? 1.4 : 0.6} />
                <rect x="1.8" y="-2" width="2.6" height="4" fill="#262822" opacity="0.8" />
              </g>
              <text x={m.x} y={m.y - 6} fontSize="6.2" fontWeight="700" textAnchor="middle" fill="#262822">{m.id}</text>
              {m.reversing && <text x={m.x} y={m.y + 11} fontSize="5.5" textAnchor="middle" fill="#C2361F" fontWeight="700">REV</text>}
            </g>
          );
        })}
        {workers.map((w) => {
          const lvl = w.risk >= 0.8 ? 'critical' : w.zone.type;
          return (
            <g key={w.id}>
              {(lvl === 'critical' || lvl === 'danger') && (
                <circle cx={w.x} cy={w.y} r="5" fill="none" stroke={WORKER[lvl]} strokeWidth="0.8">
                  <animate attributeName="r" values="3;8;3" dur="1.4s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="1;0;1" dur="1.4s" repeatCount="indefinite" />
                </circle>
              )}
              <circle cx={w.x} cy={w.y} r="2.6" fill={WORKER[lvl] ?? '#2E7D4F'} stroke="#fff" strokeWidth="0.7"><title>{`${w.id} ${w.name}: ${w.zone.name}`}</title></circle>
            </g>
          );
        })}
      </svg>
      <div className="legend">
        <span><i style={{ background: ZONE_FILL.safe }} />Safe</span>
        <span><i style={{ background: ZONE_FILL.warning }} />Warning</span>
        <span><i style={{ background: ZONE_FILL.danger }} />Danger (active dig)</span>
        <span><i style={{ background: ZONE_FILL.critical }} />Exclusion</span>
        {Object.entries(TYPE_META).map(([k, v]) => <span key={k}><i style={{ background: v.color }} />{v.label}</span>)}
        <span><i style={{ background: '#2E7D4F', borderRadius: 6 }} />Worker</span>
      </div>
    </div>
  );
}
