import { useLocation } from 'react-router-dom';
import { getTitle } from '../pageMeta.js';
import { useShell } from './ShellContext.jsx';
import { Icon } from './Icons.jsx';
import { useAuth } from '../auth-context.jsx';
import { getCopy } from '../utils/categoryCopy.js';

export function Topbar() {
  const { pathname } = useLocation();
  const { search, setSearch, filterOpen, setFilterOpen, view, setView } = useShell();
  const { business } = useAuth();
  const copy = getCopy(business?.category);
  const title = getTitle(pathname, copy);

  return (
    <header className="topbar">
      <div className="breadcrumb">
        <span className="crumb muted">My Business</span>
        <span className="crumb-sep">/</span>
        <span className="crumb">{title}</span>
      </div>
      <div className="topbar-actions">
        <div className="search-box">
          <Icon.search width={16} height={16} />
          <input
            className="search-input"
            placeholder={copy.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          className={`icon-btn ${filterOpen ? 'active' : ''}`}
          onClick={() => setFilterOpen((v) => !v)}
          title="Filter"
        >
          <Icon.filter width={18} height={18} />
        </button>
        <button
          className={`icon-btn ${view === 'compact' ? 'active' : ''}`}
          onClick={() => setView((v) => (v === 'compact' ? 'comfortable' : 'compact'))}
          title="Toggle view density"
        >
          <Icon.view width={18} height={18} />
        </button>
      </div>
    </header>
  );
}
