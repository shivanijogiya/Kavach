// In-app animated safety lessons (SVG + SMIL). Each lesson has captions that
// step in sync with the animation. Pause/play for accessibility.
import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

const Y = '#FFCD11', G = '#262822', R = '#C2361F', OK = '#2E7D4F';

function Excavator({ x = 0, y = 0, swing = true, dur = 6 }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="-34" y="18" width="68" height="12" rx="6" fill={G} />
      <g>
        {swing && <animateTransform attributeName="transform" type="rotate" values="-35 0 10;35 0 10;-35 0 10" dur={`${dur}s`} repeatCount="indefinite" />}
        <rect x="-24" y="-6" width="40" height="24" rx="3" fill={Y} />
        <rect x="-24" y="-6" width="10" height="24" fill="#b48b00" />
        <rect x="2" y="-18" width="14" height="14" rx="2" fill={Y} stroke={G} strokeWidth="1.5" />
        <path d="M16 0 L60 -26 L66 -20 L24 8 Z" fill={Y} stroke={G} strokeWidth="1" />
        <path d="M60 -26 L78 6 L70 10 L56 -18 Z" fill={Y} stroke={G} strokeWidth="1" />
        <path d="M70 6 L84 8 L78 20 L66 14 Z" fill={G} />
      </g>
    </g>
  );
}

function Person({ x, y, color = OK, children }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {children}
      <circle cy="-16" r="5" fill={color} />
      <rect x="-5" y="-11" width="10" height="16" rx="3" fill={color} />
      <rect x="-5" y="5" width="4" height="11" fill={G} />
      <rect x="1" y="5" width="4" height="11" fill={G} />
      <path d="M-6 -20 Q0 -26 6 -20 Z" fill={Y} />
    </g>
  );
}

const LESSONS = {
  swing: {
    captions: ['The upper structure can turn a full circle.', 'Everything inside the dashed circle is the swing radius.', 'A worker walks in: the machine must stop.', 'Stay out until the operator signals it is clear.'],
    svg: (
      <>
        <rect width="400" height="220" fill="#F4F2EA" />
        <rect y="180" width="400" height="40" fill="#D9D2BC" />
        <ellipse cx="200" cy="170" rx="120" ry="30" fill="rgba(194,54,31,.12)" stroke={R} strokeDasharray="6 4" strokeWidth="2" />
        <Excavator x={200} y={150} />
        <Person x={40} y={180} color={OK}>
          <animateTransform attributeName="transform" type="translate" values="40 180;120 180;120 180;40 180" keyTimes="0;0.45;0.75;1" dur="12s" repeatCount="indefinite" />
        </Person>
        <g>
          <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.4;0.45;0.75;0.8" dur="12s" repeatCount="indefinite" />
          <rect x="130" y="16" width="140" height="28" rx="4" fill={R} />
          <text x="200" y="35" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700">STOP: person in swing</text>
        </g>
      </>
    ),
  },
  blindspot: {
    captions: ['The operator sees well in front of the cab.', 'Behind the machine is a large blind zone.', 'A worker behind a reversing machine cannot be seen.', 'Radar alert fires: machine stops, worker steps aside.'],
    svg: (
      <>
        <rect width="400" height="220" fill="#F4F2EA" />
        <path d="M200 110 L380 30 L380 190 Z" fill="rgba(46,125,79,.18)" />
        <path d="M200 110 L20 20 L20 200 Z" fill="rgba(194,54,31,.22)" />
        <text x="330" y="115" fontSize="12" fill={OK} fontWeight="700">Visible</text>
        <text x="30" y="115" fontSize="12" fill={R} fontWeight="700">Blind zone</text>
        <g>
          <animateTransform attributeName="transform" type="translate" values="0 0;-30 0;-30 0;0 0" keyTimes="0;0.5;0.8;1" dur="12s" repeatCount="indefinite" />
          <rect x="176" y="96" width="56" height="30" rx="4" fill={Y} stroke={G} />
          <rect x="212" y="100" width="14" height="22" fill={G} />
        </g>
        <Person x={90} y={130} color={OK}>
          <animateTransform attributeName="transform" type="translate" values="60 60;110 120;110 120;110 190" keyTimes="0;0.45;0.8;1" dur="12s" repeatCount="indefinite" />
        </Person>
        <g>
          <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.5;0.55;0.8;0.85" dur="12s" repeatCount="indefinite" />
          <circle cx="110" cy="110" r="30" fill="none" stroke={R} strokeWidth="3">
            <animate attributeName="r" values="18;36;18" dur="0.9s" repeatCount="indefinite" />
          </circle>
          <rect x="250" y="16" width="136" height="28" rx="4" fill={R} />
          <text x="318" y="35" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700">Worker in blind spot</text>
        </g>
      </>
    ),
  },
  walkaround: {
    captions: ['Start at the front: bucket, teeth, pins.', 'Left side: tracks, rollers, hoses.', 'Rear: engine bay, fluid levels, leaks.', 'Right side and steps: clean, three points of contact.'],
    svg: (
      <>
        <rect width="400" height="220" fill="#F4F2EA" />
        <rect x="140" y="70" width="120" height="80" rx="6" fill={Y} stroke={G} strokeWidth="2" />
        <rect x="128" y="62" width="144" height="12" rx="4" fill={G} />
        <rect x="128" y="146" width="144" height="12" rx="4" fill={G} />
        <rect x="236" y="84" width="20" height="30" fill={G} />
        <path d="M260 110 L330 110" stroke={G} strokeWidth="10" />
        <rect x="120" y="36" width="160" height="148" rx="10" fill="none" stroke="#777C71" strokeDasharray="5 5" />
        {[[340, 110, 'Bucket and pins'], [200, 44, 'Tracks and hoses'], [104, 110, 'Engine and fluids'], [200, 178, 'Steps and handrails']].map(([x, y, t], i) => (
          <g key={t}>
            <circle cx={x} cy={y} r="9" fill="#fff" stroke={OK} strokeWidth="2" />
            <path d={`M${x - 4} ${y} l3 3 l5 -6`} stroke={OK} strokeWidth="2" fill="none" opacity="0">
              <animate attributeName="opacity" values="0;0;1;1" keyTimes={`0;${(i + 1) * 0.24 - 0.02};${(i + 1) * 0.24};1`} dur="12s" repeatCount="indefinite" />
            </path>
            <text x={x} y={y + (y > 150 ? 26 : y < 60 ? -14 : 24)} fontSize="11" textAnchor="middle" fill={G} fontWeight="600">{t}</text>
          </g>
        ))}
        <Person x={0} y={0} color="#2F6690">
          <animateMotion dur="12s" repeatCount="indefinite" path="M340 125 L340 36 L104 36 L104 190 L340 190 L340 125" />
        </Person>
      </>
    ),
  },
  hydraulic: {
    captions: ['The pump pushes oil into the circuit.', 'The valve sends it to the cylinder: the boom lifts.', 'Normal pressure: 300 to 350 bar.', 'A slow pressure drop is an early leak warning.'],
    svg: (
      <>
        <rect width="400" height="220" fill="#F4F2EA" />
        <rect x="30" y="80" width="70" height="60" rx="6" fill={G} />
        <text x="65" y="115" fill="#fff" fontSize="13" textAnchor="middle" fontWeight="700">Pump</text>
        <rect x="160" y="85" width="60" height="50" rx="4" fill="#2F6690" />
        <text x="190" y="115" fill="#fff" fontSize="13" textAnchor="middle" fontWeight="700">Valve</text>
        <rect x="280" y="90" width="90" height="40" rx="4" fill="#B9BDB2" />
        <rect x="286" y="96" width="40" height="28" fill={Y}>
          <animate attributeName="width" values="40;78;78;40" keyTimes="0;0.4;0.7;1" dur="12s" repeatCount="indefinite" />
        </rect>
        <text x="325" y="150" fontSize="12" textAnchor="middle" fill={G} fontWeight="600">Boom cylinder</text>
        <path id="oil" d="M100 110 L160 110 M220 110 L280 110" stroke="#C77700" strokeWidth="8" />
        {[0, 1, 2, 3].map((i) => (
          <circle key={i} r="3.5" fill="#fff">
            <animateMotion dur="1.6s" begin={`${i * 0.4}s`} repeatCount="indefinite" path="M100 110 L280 110" />
          </circle>
        ))}
        <g transform="translate(190 40)">
          <circle r="26" fill="#fff" stroke={G} strokeWidth="2" />
          <line x1="0" y1="0" x2="0" y2="-20" stroke={R} strokeWidth="3" strokeLinecap="round">
            <animateTransform attributeName="transform" type="rotate" values="-60;30;30;20;-20" keyTimes="0;0.3;0.6;0.8;1" dur="12s" repeatCount="indefinite" />
          </line>
          <text y="40" fontSize="11" textAnchor="middle" fill={G} fontWeight="600">bar</text>
        </g>
        <circle cx="240" cy="110" r="0" fill="#C77700">
          <animate attributeName="r" values="0;0;6;10" keyTimes="0;0.78;0.9;1" dur="12s" repeatCount="indefinite" />
        </circle>
      </>
    ),
  },
  sos: {
    captions: ['Press and hold SOS for 2 seconds.', 'Supervisor gets your location and machine state.', 'Machines within 30 m get a stop signal.', 'Everyone walks to the muster point.'],
    svg: (
      <>
        <rect width="400" height="220" fill="#F4F2EA" />
        <rect x="30" y="50" width="70" height="120" rx="10" fill={G} />
        <circle cx="65" cy="110" r="22" fill={R}>
          <animate attributeName="r" values="22;26;22" dur="1s" repeatCount="indefinite" />
        </circle>
        <text x="65" y="115" fill="#fff" fontSize="13" fontWeight="700" textAnchor="middle">SOS</text>
        {[0, 1, 2].map((i) => (
          <circle key={i} cx="65" cy="110" r="30" fill="none" stroke={R} strokeWidth="2">
            <animate attributeName="r" values="30;150" dur="3s" begin={`${i}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;0" dur="3s" begin={`${i}s`} repeatCount="indefinite" />
          </circle>
        ))}
        <rect x="250" y="30" width="110" height="60" rx="6" fill="#fff" stroke={G} />
        <text x="305" y="55" fontSize="11" textAnchor="middle" fill={G} fontWeight="700">Supervisor</text>
        <text x="305" y="72" fontSize="10" textAnchor="middle" fill={R}>Alarm + map pin</text>
        <g transform="translate(260 150)">
          <rect x="-24" y="-12" width="48" height="24" rx="3" fill={Y} stroke={G} />
          <text y="30" fontSize="10" textAnchor="middle" fill={R} fontWeight="700">STOPPED</text>
        </g>
        <circle cx="360" cy="190" r="12" fill={OK} />
        <text x="360" y="194" fill="#fff" fontSize="11" textAnchor="middle" fontWeight="700">M</text>
        <Person x={0} y={0} color={OK}>
          <animateMotion dur="6s" repeatCount="indefinite" path="M140 180 L340 190" />
        </Person>
      </>
    ),
  },
  weather: {
    captions: ['Clear sky: normal plan.', 'Rain starts: ground softens, slopes weaken.', 'Trenching and demolition pause automatically.', 'Plan updates with a new finish time and reasons.'],
    svg: (
      <>
        <rect width="400" height="220" fill="#F4F2EA" />
        <rect width="400" height="220" fill="#8FA3B0">
          <animate attributeName="opacity" values="0;0;0.45;0.45;0" keyTimes="0;0.25;0.35;0.9;1" dur="12s" repeatCount="indefinite" />
        </rect>
        <circle cx="330" cy="46" r="22" fill={Y}>
          <animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;0.25;0.35;0.9;1" dur="12s" repeatCount="indefinite" />
        </circle>
        <g>
          <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.25;0.35;0.9;1" dur="12s" repeatCount="indefinite" />
          {Array.from({ length: 26 }).map((_, i) => (
            <line key={i} x1={(i * 16) % 400} y1="0" x2={((i * 16) % 400) - 6} y2="14" stroke="#2F6690" strokeWidth="2">
              <animateTransform attributeName="transform" type="translate" values={`0 ${-20 - (i % 5) * 20};0 220`} dur={`${0.8 + (i % 4) * 0.15}s`} repeatCount="indefinite" />
            </line>
          ))}
        </g>
        <path d="M0 170 L140 170 L170 200 L230 200 L260 170 L400 170 L400 220 L0 220 Z" fill="#B59B72" />
        <Excavator x={320} y={140} swing={false} />
        <g>
          <animate attributeName="opacity" values="0;0;0;1;1;0" keyTimes="0;0.4;0.5;0.55;0.95;1" dur="12s" repeatCount="indefinite" />
          <rect x="30" y="24" width="220" height="56" rx="4" fill="#fff" stroke={G} />
          <text x="44" y="46" fontSize="12" fill={R} fontWeight="700">Trenching paused: rain</text>
          <text x="44" y="66" fontSize="12" fill={G}>Finish 4:20 PM → 5:05 PM</text>
        </g>
      </>
    ),
  },
};

export default function AnimatedLesson({ kind }) {
  const lesson = LESSONS[kind] ?? LESSONS.swing;
  const svgRef = useRef(null);
  const [playing, setPlaying] = useState(true);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { svgRef.current?.pauseAnimations?.(); setPlaying(false); }
  }, []);
  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(() => setStep((s) => (s + 1) % lesson.captions.length), 3000);
    return () => clearInterval(id);
  }, [playing, lesson]);
  const toggle = () => {
    if (playing) svgRef.current?.pauseAnimations?.(); else svgRef.current?.unpauseAnimations?.();
    setPlaying(!playing);
  };
  return (
    <div>
      <svg ref={svgRef} className="anim" viewBox="0 0 400 220" role="img" aria-label={lesson.captions.join(' ')}>{lesson.svg}</svg>
      <div className="row between" style={{ marginTop: 8 }}>
        <p style={{ fontWeight: 600 }}>{step + 1}. {lesson.captions[step]}</p>
        <button className="btn sm" onClick={toggle}>{playing ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Play</>}</button>
      </div>
    </div>
  );
}
