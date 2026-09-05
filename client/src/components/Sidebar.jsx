import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth-context.jsx';
import { Icon, Logo } from './Icons.jsx';
import { getCopy } from '../utils/categoryCopy.js';

export function Sidebar() {
  const { business, logout } = useAuth();
  const navigate = useNavigate();
  const copy = getCopy(business?.category);

  const links = [
    { to: '/dashboard', label: 'Dashboard', icon: Icon.chart },
    { to: '/reviews', label: 'Reviews', icon: Icon.star },
    { to: '/customers', label: copy.personPluralTitle, icon: Icon.users },
    { to: '/messages', label: 'Messages', icon: Icon.chat },
    { to: '/analytics', label: 'Analytics', icon: Icon.line },
    { to: '/settings', label: 'Settings', icon: Icon.settings },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Logo emoji={copy.logoEmoji} label={copy.categoryLabel} />
        <div>
          <div className="ws-name">Revsy</div>
          <div className="ws-sub">{business?.name || 'Your workspace'}</div>
        </div>
      </div>

      <div className="nav-section">My Business</div>
      <nav className="side-nav">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) => (isActive ? 'side-link active' : 'side-link')}
          >
            <l.icon width={18} height={18} />
            <span>{l.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="flex between" style={{ alignItems: 'center' }}>
          <div className="flex" style={{ gap: 8, alignItems: 'center' }}>
            <div className="avatar sm">{business?.name?.[0] || 'S'}</div>
            <div>
              <div className="ws-name" style={{ fontSize: 13 }}>{business?.name}</div>
              <div className="ws-sub" style={{ fontSize: 11 }}>{business?.ownerEmail}</div>
            </div>
          </div>
          <button className="btn ghost sm sq" onClick={() => { logout(); navigate('/'); }} title="Logout">
            <Icon.logout width={15} height={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
