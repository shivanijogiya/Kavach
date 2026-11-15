// Learning hub content (blueprint M11). Videos are from the official Cat Products
// YouTube channel; each course also has an in-app animated lesson and a quiz.
export const CAT_CHANNEL = 'https://www.youtube.com/catproducts';
const search = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`Cat ${q}`)}`;

export const COURSES = [
  {
    id: 'excavator-safety', title: 'Excavator safety', minutes: 18, types: ['EXC'], level: 'Core',
    video: { kind: 'video', id: 'CJM_qHYXJDA', title: 'Safety tips for your Cat excavator' },
    more: search('excavator safety tips'),
    animation: 'swing',
    reading: [
      'Walk around the machine before you climb in. Look for leaks, damage and people.',
      'Use three points of contact on the steps. Face the machine.',
      'Fasten the seatbelt before the engine starts. On this site, 92% of unbelted sessions ended in a safety alert.',
      'Keep the swing radius clear. Sound the horn before you swing or travel.',
      'Lower the bucket to the ground and lock the hydraulics before you leave the seat.',
    ],
    quiz: [
      { q: 'When should the seatbelt be fastened?', a: ['After you start digging', 'Before the engine starts', 'Only on slopes', 'Only on public roads'], c: 1 },
      { q: 'What does the swing radius mean for ground crew?', a: ['Safe place to stand', 'Area to keep clear while the upper structure can turn', 'Parking area', 'Refuel zone'], c: 1 },
      { q: 'How many points of contact on the steps?', a: ['One', 'Two', 'Three', 'Four'], c: 2 },
      { q: 'Before leaving the seat you should…', a: ['Leave the bucket raised', 'Lower the bucket and lock hydraulics', 'Keep the engine at high idle', 'Open the door only'], c: 1 },
      { q: 'You see a person near the counterweight. You…', a: ['Swing slowly', 'Stop, sound the horn, wait until clear', 'Flash lights and continue', 'Call after the task'], c: 1 },
    ],
  },
  {
    id: 'walkaround', title: 'Daily walkaround inspection', minutes: 12, types: ['EXC', 'DOZ', 'GRD', 'LOD'], level: 'Core',
    video: { kind: 'video', id: '0bAw7J7gHD0', title: 'Cat excavator daily walkaround inspection' },
    more: search('daily walkaround inspection'),
    animation: 'walkaround',
    reading: [
      'Check fluid levels: engine oil, hydraulic oil, coolant, fuel and DEF.',
      'Look at tracks or tyres, pins, bushings and hoses for wear or leaks.',
      'Clean steps, handrails and windows. Check mirrors and cameras.',
      'Test the horn, travel alarm, lights and the seatbelt latch.',
      'Report anything wrong in the app before you start. Do not operate an unsafe machine.',
    ],
    quiz: [
      { q: 'When is the walkaround done?', a: ['End of week', 'Before every shift', 'Only after a fault', 'Once a month'], c: 1 },
      { q: 'A hydraulic hose is wet with oil. You…', a: ['Wipe and start', 'Report it and do not operate', 'Tape it', 'Ignore small leaks'], c: 1 },
      { q: 'Which is NOT part of the walkaround?', a: ['Fluid levels', 'Mirrors and cameras', 'Horn and travel alarm', 'Checking the payroll'], c: 3 },
      { q: 'Why clean the steps and handrails?', a: ['Looks', 'Prevent slips and falls', 'Fuel saving', 'Warranty'], c: 1 },
      { q: 'Where do you report a defect on this site?', a: ['Tell a friend', 'Report issue in the app', 'Write on the cab', 'Nowhere'], c: 1 },
    ],
  },
  {
    id: 'blind-spot', title: 'Blind spot awareness', minutes: 10, types: ['EXC', 'DOZ', 'GRD', 'LOD'], level: 'Core',
    video: { kind: 'video', id: '6SXiEsh3eZw', title: 'Cat 333 walkaround: cameras and visibility' },
    more: search('blind spot visibility cameras'),
    animation: 'blindspot',
    reading: [
      'Every machine has zones the operator cannot see, mostly behind and on the counterweight side.',
      'Ground crew: make eye contact with the operator before you enter the work area.',
      'Operators: check mirrors and the rear camera before every reverse.',
      'Use a banksman when reversing near people or in tight areas.',
      'If you cannot see the person, assume they cannot see you.',
    ],
    quiz: [
      { q: 'Where is the largest blind spot on most machines?', a: ['Directly in front of the cab', 'Behind the machine', 'On the roof', 'Inside the cab'], c: 1 },
      { q: 'Before entering a work area, ground crew should…', a: ['Wave once', 'Get eye contact with the operator', 'Run past quickly', 'Call the office'], c: 1 },
      { q: 'Who guides a machine reversing near people?', a: ['Nobody', 'A banksman', 'The fuel driver', 'The surveyor'], c: 1 },
      { q: 'The rear camera is dirty. You…', a: ['Rely on mirrors only', 'Clean it before operating', 'Reverse faster', 'Ignore it'], c: 1 },
      { q: 'The radar shows a worker behind you. You…', a: ['Reverse slowly', 'Stop and wait until they are clear', 'Sound horn and reverse', 'Turn the radio up'], c: 1 },
    ],
  },
  {
    id: 'hydraulics', title: 'Hydraulic system basics', minutes: 20, types: ['EXC', 'LOD'], level: 'Skill',
    video: { kind: 'playlist', id: 'PLjMeT-rwp70gInhrRhtSCrEFJ_6xt91Nq', title: 'Introduction to Cat excavators (playlist)' },
    more: search('hydraulic system excavator'),
    animation: 'hydraulic',
    reading: [
      'The pump turns engine power into oil flow. Valves send it to cylinders and motors.',
      'Normal working pressure on this fleet sits around 300 to 350 bar.',
      'A slow, steady drop in pressure is an early sign of a leak or pump wear. The app flags it before it fails.',
      'Never search for a leak with your hand. Pressurised oil can pierce skin.',
      'Relieve pressure and lower attachments before any hydraulic work.',
    ],
    quiz: [
      { q: 'What turns engine power into oil flow?', a: ['Cylinder', 'Pump', 'Radiator', 'Battery'], c: 1 },
      { q: 'A safe way to look for a pinhole leak?', a: ['Run your hand along the hose', 'Use cardboard and eye protection', 'Squeeze the hose', 'Smell it'], c: 1 },
      { q: 'Pressure slowly drifting down usually means…', a: ['Everything is fine', 'Early leak or pump wear', 'Too much fuel', 'Cold weather only'], c: 1 },
      { q: 'Before hydraulic maintenance you must…', a: ['Keep the engine running', 'Lower attachments and relieve pressure', 'Raise the boom', 'Add more oil'], c: 1 },
      { q: 'Normal working pressure here is about…', a: ['30 bar', '300–350 bar', '3,000 bar', '5 bar'], c: 1 },
    ],
  },
  {
    id: 'emergency', title: 'Emergency procedures', minutes: 8, types: ['EXC', 'DOZ', 'GRD', 'LOD'], level: 'Core',
    video: { kind: 'video', id: 'WHGoyJ-FRPo', title: 'Cat safety tips: operating compact machines' },
    more: search('emergency shutdown procedure'),
    animation: 'sos',
    reading: [
      'Press and hold SOS for 2 seconds in the app. Your location and machine state go to the supervisor.',
      'Machines within 30 m get a stop signal.',
      'Walk to the muster point shown on your phone. Stay upwind of smoke or dust.',
      'For a fire: shut down the engine, use the extinguisher only if it is safe, then leave.',
      'For a rollover: stay in the seat with the belt on. Do not jump out.',
    ],
    quiz: [
      { q: 'How do you raise SOS in the app?', a: ['Double tap', 'Press and hold for 2 seconds', 'Shake twice', 'Email'], c: 1 },
      { q: 'During a rollover you should…', a: ['Jump out', 'Stay seated with the belt on', 'Open the door', 'Stand up'], c: 1 },
      { q: 'After an alarm, go to…', a: ['Your car', 'The muster point', 'The fuel bay', 'The canteen'], c: 1 },
      { q: 'Machines near an SOS…', a: ['Keep working', 'Receive a stop signal', 'Speed up', 'Sound music'], c: 1 },
      { q: 'Fighting a machine fire is OK when…', a: ['Always', 'Only if it is safe and small', 'Never report it', 'After the shift'], c: 1 },
    ],
  },
  {
    id: 'weather', title: 'Working in bad weather', minutes: 9, types: ['EXC', 'DOZ', 'GRD', 'LOD'], level: 'Skill',
    video: { kind: 'playlist', id: 'PLjMeT-rwp70gKrwrRzW5Vy33-qCUGsqfP', title: 'Cat dozers at work (playlist)' },
    more: search('dozer safety features'),
    animation: 'weather',
    reading: [
      'Rain makes ground soft and slopes unstable. Trenching and demolition pause automatically in rain.',
      'In rain, tasks here take about 25% longer. Plan for it rather than rushing.',
      'Fog: slow down, lights on, and rely on the radar and banksman.',
      'Heat: drink water every hour. The app raises your fatigue score and will prompt breaks.',
      'Lightning: stop, lower attachments, stay in the cab or go to shelter.',
    ],
    quiz: [
      { q: 'How much longer do tasks take in rain on this site?', a: ['No change', 'About 25%', 'About 200%', 'They are faster'], c: 1 },
      { q: 'Which task pauses automatically in rain?', a: ['Grading', 'Trenching', 'Refuelling', 'Briefing'], c: 1 },
      { q: 'In fog you should…', a: ['Drive faster to finish', 'Slow down and use lights and radar', 'Turn lights off', 'Ignore the banksman'], c: 1 },
      { q: 'In lightning, stay…', a: ['On top of the machine', 'In the cab or a shelter', 'Under a tree', 'In the trench'], c: 1 },
      { q: 'A high fatigue score means…', a: ['Work faster', 'Take a break with water', 'Skip lunch', 'Nothing'], c: 1 },
    ],
  },
  {
    id: 'loader', title: 'Wheel loader operation', minutes: 15, types: ['LOD'], level: 'Machine',
    video: { kind: 'playlist', id: 'PLjMeT-rwp70ii_Ic31eO5WToKtTNZK2J3', title: 'Introduction to Cat wheel loaders (playlist)' },
    more: search('wheel loader operating tips'),
    animation: 'swing',
    reading: [
      'Carry the bucket low when travelling. It lowers the centre of gravity.',
      'Load trucks from the operator side so both drivers can see each other.',
      'Keep a smooth V-pattern when loading to cut cycle time and tyre wear.',
      'Idling costs fuel. Shut down during long waits.',
      'Check the articulation lock is released before driving and fitted for service.',
    ],
    quiz: [
      { q: 'Travel with the bucket…', a: ['Fully raised', 'Low', 'Tilted forward', 'Removed'], c: 1 },
      { q: 'Common efficient truck-loading path?', a: ['Circle', 'V-pattern', 'Zig-zag', 'Straight reverse'], c: 1 },
      { q: 'Long wait at the stockpile. You…', a: ['Keep revving', 'Shut down to save fuel', 'Leave the cab running', 'Drive around'], c: 1 },
      { q: 'The articulation lock should be…', a: ['On while driving', 'Released before driving', 'Removed forever', 'Ignored'], c: 1 },
      { q: 'Why load from the operator side?', a: ['Faster', 'Both drivers can see each other', 'Less noise', 'Tradition'], c: 1 },
    ],
  },
];

export const courseById = Object.fromEntries(COURSES.map((c) => [c.id, c]));

// Personalised next lesson from the operator's own data (blueprint M11)
export function recommendCourses(op, machine, recentRisk = 0) {
  const recs = [];
  if (op && op.unbeltedRate > 0.12) recs.push({ id: 'excavator-safety', reason: `Your seatbelt was unfastened in ${(op.unbeltedRate * 100).toFixed(0)}% of sessions` });
  if (recentRisk >= 0.5 || (op && op.alertRate > 0.13)) recs.push({ id: 'blind-spot', reason: 'Recent proximity alerts around your machine' });
  if (machine && machine.health < 66) recs.push({ id: 'hydraulics', reason: `${machine.id} health is ${machine.health}. Know the early warning signs` });
  if (machine?.type === 'LOD') recs.push({ id: 'loader', reason: 'Matches the machine you are operating today' });
  recs.push({ id: 'walkaround', reason: 'Refresher before every shift' });
  const seen = new Set();
  return recs.filter((r) => (seen.has(r.id) ? false : seen.add(r.id))).slice(0, 3);
}
