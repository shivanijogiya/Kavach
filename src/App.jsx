import { useEffect, useState } from 'react';
import { loadData, DataCtx } from './lib/data';
import { useSite } from './lib/store';
import { useLiveWeather } from './lib/sim';
import Login from './pages/Login';
import Operator from './pages/Operator';
import Supervisor from './pages/Supervisor';

// Session lives in sessionStorage so each browser tab can hold a different role
// (supervisor in one tab, operator in another) while sharing the same site state.
const SKEY = 'sitesense.session';

export default function App() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [session, setSession] = useState(() => { try { return JSON.parse(sessionStorage.getItem(SKEY)); } catch { return null; } });
  const site = useSite();
  useLiveWeather(!!session, site.weather.source);

  useEffect(() => { loadData().then(setData).catch((e) => setErr(e.message)); }, []);
  const login = (s) => { sessionStorage.setItem(SKEY, JSON.stringify(s)); setSession(s); };
  const logout = () => { sessionStorage.removeItem(SKEY); setSession(null); };

  if (err) return <div className="empty" style={{ padding: 60 }}><h2>Could not load site data</h2><p>{err}</p></div>;
  if (!data) return <div className="empty" style={{ padding: 60 }}>Loading site data…</div>;
  return (
    <DataCtx.Provider value={data}>
      {!session ? <Login onLogin={login} />
        : session.role === 'supervisor' ? <Supervisor onLogout={logout} />
          : <Operator session={session} onLogout={logout} />}
    </DataCtx.Provider>
  );
}
