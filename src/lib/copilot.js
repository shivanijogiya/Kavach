// Site copilot (blueprint 6.6). Answers come from live platform data through
// deterministic intent matching, which is also the documented offline fallback.
// To use an LLM, send the same `context` object to your model with tool use and
// keep these answers as the fallback when it is unreachable.
import { fmtTime, healthLabel, predictMinutes } from './engines';
import { WEATHER_UNSAFE } from './config';

// ---------- Morning briefing in three languages ----------
export function buildBriefing(lang, c) {
  const { name, machine, health, fuel, tasks, weather, unsafe, focus, finish } = c;
  const list = tasks.map((t) => t.type).join(', ') || '-';
  if (lang === 'ta') {
    return [
      `வணக்கம் ${name}. இன்று நீங்கள் ${machine} இயந்திரத்தை இயக்குகிறீர்கள்.`,
      `வானிலை: ${weather.condition}, ${weather.temp}°C. ${unsafe ? 'மழையால் சில பணிகள் நிறுத்தப்பட்டுள்ளன.' : ''}`,
      `இன்றைய பணிகள் ${tasks.length}: ${list}. முடிக்கும் நேரம் சுமார் ${finish}.`,
      `இயந்திர நிலை ${health}/100. எரிபொருள் ${fuel}%.`,
      `பாதுகாப்பு: இன்ஜின் இயக்கும் முன் சீட் பெல்ட் அணியுங்கள். ${focus}`,
    ];
  }
  if (lang === 'hi') {
    return [
      `नमस्ते ${name}. आज आप ${machine} चला रहे हैं.`,
      `मौसम: ${weather.condition}, ${weather.temp}°C. ${unsafe ? 'बारिश के कारण कुछ काम रोके गए हैं.' : ''}`,
      `आज के ${tasks.length} काम: ${list}. अनुमानित समाप्ति ${finish}.`,
      `मशीन की हालत ${health}/100. ईंधन ${fuel}%.`,
      `सुरक्षा: इंजन चालू करने से पहले सीट बेल्ट लगाएं. ${focus}`,
    ];
  }
  return [
    `Good morning, ${name}. You are on ${machine} today.`,
    `Weather: ${weather.condition.toLowerCase()}, ${weather.temp}°C, wind ${weather.wind} km/h.${unsafe ? ` ${unsafe} paused for weather.` : ''}`,
    `You have ${tasks.length} task${tasks.length === 1 ? '' : 's'}: ${list}. Predicted finish ${finish}.`,
    `Machine health ${health}/100 (${healthLabel(health).toLowerCase()}), fuel ${fuel}%.`,
    `Safety focus: ${focus}`,
  ];
}

export function speak(lines, lang) {
  if (!('speechSynthesis' in window)) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(lines.join(' '));
  u.lang = { en: 'en-IN', hi: 'hi-IN', ta: 'ta-IN' }[lang] ?? 'en-IN';
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
  return true;
}

// ---------- Toolbox talk generator (innovation) ----------
export function toolboxTalk({ weather, alerts, issues, seatbelt }) {
  const lines = [`Toolbox talk for ${new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}.`];
  lines.push(`Weather is ${weather.condition.toLowerCase()} at ${weather.temp}°C.${WEATHER_UNSAFE[weather.condition] ? ` ${WEATHER_UNSAFE[weather.condition].join(' and ')} stay paused until conditions improve.` : ''}`);
  if (seatbelt) lines.push(`Our data shows ${seatbelt.unfastened}% of unbelted sessions trigger a safety alert, against ${seatbelt.fastened}% when belted. Buckle up before the engine starts.`);
  if (alerts?.length) lines.push(`Yesterday's pattern: ${alerts.length} proximity or zone alerts. Make eye contact with the operator before you enter any swing radius.`);
  if (issues?.length) lines.push(`Open site issues: ${issues.map((i) => i.text).slice(0, 2).join(' ')}`);
  if (weather.temp >= 33) lines.push('Heat: drink water every hour, and take your shaded breaks. The app will prompt you.');
  lines.push('Any question, ask your supervisor or the copilot in the app. Stay safe.');
  return lines.join(' ');
}

// ---------- Chat ----------
const PROCEDURES = {
  hydraulic: 'Hydraulic leak: 1) Lower the attachment to the ground. 2) Shut down the engine and relieve pressure. 3) Keep hands away from the leak; pressurised oil can pierce skin. 4) Contain the spill with absorbent. 5) Report it in the app and tag the machine out of service.',
  fire: 'Machine fire: 1) Stop, lower the attachment, shut down. 2) Raise SOS. 3) Use the extinguisher only if the fire is small and you have a clear exit. 4) Move upwind to the muster point.',
  rollover: 'Rollover: stay in the seat with the belt on, hold the wheel or armrests, and do not jump. Raise SOS once the machine is still.',
  injury: 'Injury: make the area safe, raise SOS with type "Injury", do not move the person unless there is danger, and give first aid if trained.',
  refuel: 'Refuel: park on level ground at the fuel bay, engine off, no phones or smoking, keep the nozzle in contact with the tank.',
};

export function answer(q, ctx) {
  const s = q.toLowerCase();
  const { role, machine, tel, tasks = [], weather, health, siteSnap, replans = [], model, op } = ctx;
  const has = (...w) => w.some((x) => s.includes(x));

  if (has('hydraulic leak', 'leak')) return PROCEDURES.hydraulic;
  if (has('fire', 'smoke')) return PROCEDURES.fire;
  if (has('rollover', 'tip over', 'tipping')) return PROCEDURES.rollover;
  if (has('injur', 'hurt', 'bleed')) return PROCEDURES.injury;
  if (has('refuel', 'diesel')) return PROCEDURES.refuel;

  if (has('safe to dig', 'safe to work', 'is it safe', 'can i dig', 'safe to')) {
    const unsafe = WEATHER_UNSAFE[weather.condition] ?? [];
    const zone = s.match(/zone\s*([a-e])/i)?.[1]?.toUpperCase();
    const bits = [];
    if (unsafe.length) bits.push(`Not for ${unsafe.join(' or ').toLowerCase()} right now: it is ${weather.condition.toLowerCase()}.`);
    else bits.push(`Weather is ${weather.condition.toLowerCase()}, no weather stop in force.`);
    if (zone) bits.push(`Zone ${zone} is ${['A', 'B'].includes(zone) ? 'an active dig area. Confirm the ground crew is clear and the swing radius is marked' : 'open. Watch the haul road crossing'}.`);
    if (health !== undefined && health < 60) bits.push(`Your machine health is ${health}. Check the warnings on the Overview before you start.`);
    return bits.join(' ');
  }
  if (has('fuel')) return tel ? `Fuel is at ${tel.fuelPct.toFixed(0)}%. At the current burn that lasts about ${Math.max(0, Math.round(tel.fuelPct / 0.05 / 60))} more working minutes in this demo.` : 'Open the fleet view to see fuel by machine.';
  if (has('health', 'condition', 'status of', 'how is my machine')) return machine ? `${machine.id} (${machine.model}) health is ${health}/100: ${healthLabel(health).toLowerCase()}. Service due in ${machine.serviceDueIn} engine hours.` : 'Fleet health is on the Fleet page.';
  if (has('service', 'maintenance')) return machine ? `${machine.id} is at ${machine.engineHours.toLocaleString()} engine hours. Next 500-hour service is due in ${machine.serviceDueIn} hours.` : 'See the maintenance queue on the Fleet page.';
  if (has('task', 'left', 'remaining', 'what next', 'todo', 'to do')) {
    const open = tasks.filter((t) => t.status !== 'done');
    if (!open.length) return 'Nothing left on your list. Check in with your supervisor for the next assignment.';
    return `You have ${open.length} open task${open.length > 1 ? 's' : ''}: ${open.map((t) => `${t.type} in ${t.zone} (${t.status.replace('_', ' ')}, about ${t.predicted} min)`).join('; ')}.`;
  }
  if (has('weather', 'rain', 'temperature', 'hot')) return `It is ${weather.condition.toLowerCase()}, ${weather.temp}°C, humidity ${weather.humidity}%, wind ${weather.wind} km/h, visibility ${weather.visibility} km. ${weather.source === 'what-if' ? 'This is a what-if scenario set by the supervisor.' : ''}`;
  if (has('seatbelt', 'belt')) return 'Fasten it before the engine starts. On this fleet, 92% of sessions with an unfastened belt triggered a safety alert, against 2% when fastened.';
  if (has('why') && has('plan', 'change', 'replan')) {
    const r = replans[0];
    return r ? `The plan changed at ${fmtTime(r.ts)}: ${r.reasons.join('; ')}. Finish moved from ${fmtTime(r.oldFinish)} to ${fmtTime(r.newFinish)}.` : 'The plan has not changed today.';
  }
  if (has('closest', 'nearest', 'who is near') && siteSnap) {
    const id = s.match(/(exc|doz|grd|lod)\s*0*(\d+)/i);
    const m = id ? siteSnap.machines.find((x) => x.id.toLowerCase() === `${id[1]}${id[2].padStart(3, '0')}`.toLowerCase()) : siteSnap.machines[0];
    if (!m) return 'That machine is not on the live map right now.';
    const w = [...siteSnap.workers].sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y))[0];
    return `${w.id} (${w.name}) is closest to ${m.id}, about ${Math.hypot(w.x - m.x, w.y - m.y).toFixed(0)} m away, in ${w.zone.name}.`;
  }
  if (has('how long', 'estimate', 'predict') && model) {
    const type = ['Earth Excavation', 'Trenching', 'Demolition', 'Site Clearing', 'Backfilling', 'Grading', 'Material Loading', 'Hauling'].find((t) => s.includes(t.toLowerCase().split(' ')[0]));
    if (type) return `${type} takes about ${predictMinutes(model, { type, weather: weather.condition, skill: op?.skill ?? 'Intermediate', age: 5 })} minutes in ${weather.condition.toLowerCase()} weather for a ${(op?.skill ?? 'intermediate').toLowerCase()} operator. Planned estimates on this site run about 20% short; this corrects for it.`;
  }
  if (has('sos', 'emergency')) return 'Press and hold the red SOS button for 2 seconds. Your location and machine state go to the supervisor, and machines within 30 m get a stop signal.';
  if (has('hello', 'hi', 'hey')) return role === 'supervisor' ? 'Hello. Ask me who is closest to a machine, why the plan changed, or how long a task will take.' : 'Hello. Ask me about your tasks, fuel, machine health, weather, or a procedure like a hydraulic leak.';
  return role === 'supervisor'
    ? 'I can answer: "Who is closest to EXC001?", "Why did the plan change?", "How long will trenching take?", "What is the weather?", or procedures like "hydraulic leak".'
    : 'I can answer: "What tasks are left?", "How is my machine?", "Is it safe to dig in zone B?", "Fuel?", or procedures like "hydraulic leak" and "fire".';
}
