import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './Icons.jsx';
import { getCopy } from '../utils/categoryCopy.js';
import { useAuth } from '../auth-context.jsx';

const PRIMARY = [
  { to: '/dashboard', label: 'Home', icon: Icon.chart, end: true },
  { to: '/reviews', label: 'Reviews', icon: Icon.star },
  { to: '/customers', label: 'People', icon: Icon.users, dynamicLabel: true },
  { to: '/messages', label: 'Chat', icon: Icon.chat },
];

export function MobileBottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { business } = useAuth();
  const copy = getCopy(business?.category);
  const [moreOpen, setMoreOpen] = useState(false);

  const isMoreActive = pathname === '/analytics' || pathname === '/settings';

  return (
    <>
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <div className="mobile-bottom-nav-inner">
          {PRIMARY.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}
            >
              <item.icon width={22} height={22} />
              <span>{item.dynamicLabel ? copy.personPluralTitle.split(' ')[0] : item.label}</span>
            </NavLink>
          ))}
          <button
            type="button"
            className={`mobile-nav-item${isMoreActive ? ' active' : ''}`}
            aria-expanded={moreOpen}
            aria-label="More options"
            onClick={() => setMoreOpen(true)}
          >
            <Icon.settings width={22} height={22} />
            <span>More</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <button
          type="button"
          className="mobile-more-sheet"
          aria-label="Close menu"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="mobile-more-panel"
            role="dialog"
            aria-modal="true"
            aria-label="More navigation"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>More</h3>
            <button
              type="button"
              className="mobile-more-link"
              onClick={() => { setMoreOpen(false); navigate('/analytics'); }}
            >
              <Icon.line width={20} height={20} />
              Analytics
            </button>
            <button
              type="button"
              className="mobile-more-link"
              onClick={() => { setMoreOpen(false); navigate('/settings'); }}
            >
              <Icon.settings width={20} height={20} />
              Settings
            </button>
            <button type="button" className="btn secondary" style={{ width: '100%', marginTop: 8 }} onClick={() => setMoreOpen(false)}>
              Close
            </button>
          </div>
        </button>
      )}
    </>
  );
}
