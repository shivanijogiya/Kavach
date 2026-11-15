// Loads the JSON produced from the CSV datasets (scripts/preprocess.py).
import { createContext, useContext } from 'react';

let cache = null;
export async function loadData() {
  if (cache) return cache;
  const names = ['machines', 'operators', 'fleet', 'tasks'];
  const [machines, operators, fleet, tasks] = await Promise.all(names.map((n) => fetch(`/data/${n}.json`).then((r) => {
    if (!r.ok) throw new Error(`Missing /data/${n}.json. Run: npm run data`);
    return r.json();
  })));
  cache = {
    machines, operators, fleet, tasks,
    machineById: Object.fromEntries(machines.map((m) => [m.id, m])),
    opById: Object.fromEntries(operators.map((o) => [o.id, o])),
    fleetAvg: {
      alertRate: fleet.kpis.alertRate,
      unbeltedRate: 1 - fleet.kpis.beltCompliance,
      avgIdle: operators.reduce((a, o) => a + o.avgIdle, 0) / operators.length,
      health: machines.reduce((a, m) => a + m.health, 0) / machines.length,
    },
  };
  return cache;
}

export const DataCtx = createContext(null);
export const useData = () => useContext(DataCtx);
