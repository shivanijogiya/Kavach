// Site-level configuration. Thresholds live here so the engines and the UI read one source.
export const SITE = {
  id: 'SITE-04',
  name: 'Ring Road Package 3',
  area: 'Earthworks and trenching',
  lat: 12.97,
  lng: 79.16,
  shiftStart: 8,
  shiftEnd: 17,
};

export const SUPERVISOR = { id: 'SUP-01', name: 'Site supervisor', pin: '1234' };

export const TYPE_META = {
  EXC: { label: 'Excavator', color: '#E0A800', swing: 9 },
  DOZ: { label: 'Dozer', color: '#2F6690', swing: 6 },
  GRD: { label: 'Motor grader', color: '#5F8D4E', swing: 6 },
  LOD: { label: 'Wheel loader', color: '#9C6644', swing: 7 },
};

export const TASK_TYPES = ['Earth Excavation', 'Trenching', 'Demolition', 'Site Clearing', 'Backfilling', 'Grading', 'Material Loading', 'Hauling'];
export const TASKS_FOR = {
  EXC: ['Earth Excavation', 'Trenching', 'Demolition'],
  DOZ: ['Site Clearing', 'Backfilling'],
  GRD: ['Grading'],
  LOD: ['Material Loading', 'Hauling'],
};
export const WEATHERS = ['Sunny', 'Cloudy', 'Windy', 'Foggy', 'Rainy', 'Snowy'];
export const SKILLS = ['Beginner', 'Intermediate', 'Expert'];
export const ZONES = ['Zone A (north cut)', 'Zone B (trench line)', 'Zone C (stockpile)', 'Zone D (haul road)', 'Zone E (fill area)'];

// Hard safety constraints used by the re-planner (blueprint 6.5)
export const WEATHER_UNSAFE = {
  Rainy: ['Trenching', 'Demolition'],
  Snowy: ['Trenching', 'Demolition', 'Hauling', 'Earth Excavation'],
  Foggy: ['Hauling'],
};
export const MIN_HEALTH_TO_OPERATE = 40;

export const THRESHOLDS = {
  engineTemp: { warn: 98, crit: 104, unit: '°C', label: 'Engine temp' },
  hydraulic: { low: 285, high: 375, unit: 'bar', label: 'Hydraulic pressure' },
  oil: { low: 210, unit: 'kPa', label: 'Oil pressure' },
  fuel: { low: 18, crit: 10, unit: '%', label: 'Fuel' },
  battery: { low: 24.2, unit: 'V', label: 'Battery' },
};

export const DIESEL_CO2_KG_PER_L = 2.68;
export const DIESEL_PRICE_INR = 92;
export const IDLE_BURN_L_PER_H = 3.2; // typical mid-size machine at low idle
