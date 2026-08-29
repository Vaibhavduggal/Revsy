import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth-context.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { Topbar } from './components/Topbar.jsx';
import { ShellProvider } from './components/ShellContext.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Customers from './pages/Customers.jsx';
import Messages from './pages/Messages.jsx';
import Analytics from './pages/Analytics.jsx';
import Settings from './pages/Settings.jsx';
import Admin from './pages/Admin.jsx';

function Protected({ children }) {
  const { business, ready } = useAuth();
  if (!ready) return <div className="empty">Loading…</div>;
  if (!business) return <Navigate to="/login" replace />;
  return (
    <ShellProvider>
      <div className="app-shell">
        <Sidebar />
        <div className="main-col">
          <Topbar />
          <main className="main-content">{children}</main>
        </div>
      </div>
    </ShellProvider>
  );
}

function PublicOnly({ children }) {
  const { business, ready } = useAuth();
  if (!ready) return <div className="empty">Loading…</div>;
  if (business) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicOnly><Landing /></PublicOnly>} />
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/customers" element={<Protected><Customers /></Protected>} />
      <Route path="/messages" element={<Protected><Messages /></Protected>} />
      <Route path="/analytics" element={<Protected><Analytics /></Protected>} />
      <Route path="/settings" element={<Protected><Settings /></Protected>} />
      <Route path="/admin" element={<Protected><Admin /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
