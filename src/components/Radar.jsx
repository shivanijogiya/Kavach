// Operator cab "safety pulse": people around the machine with live collision risk
const COLOR = { safe: '#2E7D4F', warning: '#C77700', critical: '#C2361F' };

export default function Radar({ radar, range = 40 }) {
  const S = 110 / range;
  const { machine, workers } = radar;
  const rear = machine.heading + Math.PI;
  const wedge = (a0, a1, r) => {
    const p = (a) => `${Math.cos(a) * r},${Math.sin(a) * r}`;
    return `M0,0 L${p(a0)} A${r},${r} 0 0 1 ${p(a1)} Z`;
  };
  return (
    <svg viewBox="-120 -120 240 240" style={{ width: '100%', maxWidth: 340, display: 'block', margin: '0 auto' }} role="img" aria-label="Proximity radar around the machine">
      <circle r="118" fill="#262822" />
      {[10, 20, 30, 40].map((d) => (
        <g key={d}>
          <circle r={d * S} fill="none" stroke="#4d5146" strokeWidth="0.8" />
          <text x="2" y={-d * S + 8} fontSize="7" fill="#8d9285">{d} m</text>
        </g>
      ))}
      <path d={wedge(rear - Math.PI / 3, rear + Math.PI / 3, 18 * S)} fill="rgba(194,54,31,.28)" />
      <line x1="0" y1="0" x2={Math.cos(machine.heading) * 30} y2={Math.sin(machine.heading) * 30} stroke="#FFCD11" strokeWidth="1.2" />
      <g transform={`rotate(${(machine.heading * 180) / Math.PI})`}>
        <rect x="-10" y="-6.5" width="20" height="13" rx="2" fill="#FFCD11" />
        <rect x="3" y="-4" width="5" height="8" fill="#262822" />
      </g>
      {machine.reversing && <text y="24" fontSize="8" fill="#FF8C7A" textAnchor="middle" fontWeight="700">REVERSING</text>}
      {workers.filter((w) => w.dist <= range).map((w) => (
        <g key={w.id} transform={`translate(${w.x * S} ${w.y * S})`}>
          {w.level !== 'safe' && (
            <circle r="6" fill="none" stroke={COLOR[w.level]} strokeWidth="1">
              <animate attributeName="r" values="4;10;4" dur="1.2s" repeatCount="indefinite" />
            </circle>
          )}
          <circle r="4" fill={COLOR[w.level]} stroke="#fff" strokeWidth="1" />
          <text y="-7" fontSize="6.5" fill="#E9EAE4" textAnchor="middle">{w.id}</text>
        </g>
      ))}
    </svg>
  );
}
