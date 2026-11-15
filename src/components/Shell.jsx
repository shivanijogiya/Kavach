import { CloudRain, CloudSun, Cloud, CloudFog, Wind, Snowflake, Sun, LogOut } from 'lucide-react';
import { useTick } from '../lib/sim';
import { SITE } from '../lib/config';

export const WeatherIcon = ({ c, size = 15 }) => {
  const I = { Sunny: Sun, Cloudy: Cloud, Rainy: CloudRain, Foggy: CloudFog, Windy: Wind, Snowy: Snowflake }[c] ?? CloudSun;
  return <I size={size} />;
};

function Mark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 32 32"><path d="M3 25 L13 9 L18 17 L22 12 L29 25 Z" fill="#262822" /></svg>
    </div>
  );
}

export default function Shell({ nav, active, onNav, title, sub, weather, right, user, onLogout, children }) {
  useTick(30000);
  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <Mark />
          <div>
            <div className="brand-name">SiteSense</div>
            <div className="brand-sub">{SITE.name}</div>
          </div>
        </div>
        <nav aria-label="Main">
          {nav.map((n) => (
            <button key={n.id} aria-current={active === n.id ? 'page' : undefined} onClick={() => onNav(n.id)}>
              <n.icon size={17} /> {n.label}
              {n.count ? <span className={`count ${n.red ? 'red' : ''}`}>{n.count}</span> : null}
            </button>
          ))}
        </nav>
        <div className="rail-foot">
          <strong>{user.name}</strong>
          {user.meta}
          <button onClick={onLogout}><LogOut size={13} style={{ verticalAlign: -2, marginRight: 6 }} />Sign out</button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div>
            <div className="title">{title}</div>
            <div className="sub">{sub}</div>
          </div>
          <div className="spacer" />
          <span className={`chip ${weather.source === 'what-if' ? 'whatif' : ''}`} title={weather.source === 'what-if' ? 'What-if scenario set by the supervisor' : weather.source === 'live' ? 'Live from Open-Meteo' : 'Default conditions'}>
            <WeatherIcon c={weather.condition} /> {weather.condition} {weather.temp}°C
            {weather.source === 'what-if' && <strong style={{ marginLeft: 4 }}>what-if</strong>}
          </span>
          <span className="chip"><span className="live-dot" /> {new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
          {right}
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
