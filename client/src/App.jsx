import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth-context.jsx';
import { useAdminAuth } from './admin-auth-context.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { Topbar } from './components/Topbar.jsx';
import { ShellProvider } from './components/ShellContext.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Reviews from './pages/Reviews.jsx';
import Customers from './pages/Customers.jsx';
import Messages from './pages/Messages.jsx';
import Analytics from './pages/Analytics.jsx';
import Settings from './pages/Settings.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import Admin from './pages/Admin.jsx';
import Onboarding from './pages/Onboarding.jsx';
import AuthCallback from './pages/AuthCallback.jsx';
import Demo from './pages/Demo.jsx';

function Protected({ children }) {
  const { business, ready } = useAuth();
  if (!ready) return <div className="empty">Loading…</div>;
  if (!business) return <Navigate to="/login" replace />;
  // onboarding gate: if not completed and not demo, force to /onboarding
  if (business.onboardingCompleted === false && !business.isDemo && window.location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }
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

function OnboardingGate({ children }) {
  const { business, ready } = useAuth();
  if (!ready) return <div className="empty">Loading…</div>;
  if (!business) return <Navigate to="/login" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { business, ready } = useAuth();
  if (!ready) return <div className="empty">Loading…</div>;
  if (business) return <Navigate to="/dashboard" replace />;
  return children;
}

// Admin routes are intentionally isolated from the client business auth above —
// a client owner's session can never reach these, and vice versa.
function AdminProtected({ children }) {
  const ctx = useAdminAuth();
  const admin = ctx?.admin;
  const ready = ctx?.ready;
  if (!ready) return <div className="empty">Loading…</div>;
  if (!admin) return <Navigate to="/admin/login" replace />;
  return children;
}

function AdminPublicOnly({ children }) {
  const ctx = useAdminAuth();
  const admin = ctx?.admin;
  const ready = ctx?.ready;
  if (!ready) return <div className="empty">Loading…</div>;
  if (admin) return <Navigate to="/admin" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicOnly><Landing /></PublicOnly>} />
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
      <Route path="/demo" element={<Demo />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/onboarding" element={<OnboardingGate><Onboarding /></OnboardingGate>} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/reviews" element={<Protected><Reviews /></Protected>} />
      <Route path="/customers" element={<Protected><Customers /></Protected>} />
      <Route path="/messages" element={<Protected><Messages /></Protected>} />
      <Route path="/analytics" element={<Protected><Analytics /></Protected>} />
      <Route path="/settings" element={<Protected><Settings /></Protected>} />
      <Route path="/admin/login" element={<AdminPublicOnly><AdminLogin /></AdminPublicOnly>} />
      <Route path="/admin" element={<AdminProtected><Admin /></AdminProtected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
