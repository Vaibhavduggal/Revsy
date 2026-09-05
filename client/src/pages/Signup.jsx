import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth-context.jsx';
import { Logo } from '../components/Icons.jsx';
import GeoAccent from '../components/marketing/GeoAccent.jsx';
import GoogleSignIn from '../components/GoogleSignIn.jsx';
import { useToast } from '../components/useToast.jsx';

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const { show, node } = useToast();
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const biz = await signup(email, password, businessName);
      show(`Welcome, ${biz.name}! Let's get you set up.`);
      navigate('/onboarding');
    } catch (err) {
      show(err.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="editorial-shell" style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="card" style={{ width: '100%', maxWidth: 400 }}>
        <div className="brand" style={{ justifyContent: 'center', marginBottom: 8 }}><Logo /><span>Revsy</span></div>
        <p className="editorial-kicker" style={{ justifyContent: 'center', width: '100%' }}><GeoAccent /> Get started</p>
        <h2 style={{ textAlign: 'center', fontSize: 28 }}>Create your account</h2>
        <p className="sub" style={{ textAlign: 'center', marginBottom: 18 }}>Start collecting Google reviews on autopilot</p>

        <GoogleSignIn businessName={businessName} label="Sign up with Google" onError={show} />

        <div className="flex" style={{ alignItems: 'center', gap: 10, margin: '16px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          <span className="csv-hint">or email</span>
          <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <label>Business name</label>
            <input className="input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Punjabi Tadka" required autoFocus />
          </div>
          <div className="field">
            <label>Work email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourbusiness.com" required />
          </div>
          <div className="field">
            <label>Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <div className="csv-hint" style={{ marginBottom: 12 }}>If your email was invited by an admin, you'll be pre-approved.</div>
          <button className="btn" style={{ width: '100%' }} type="submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <div className="csv-hint" style={{ textAlign: 'center', marginTop: 14 }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Log in</Link>
        </div>
      </div>
      {node}
    </div>
  );
}
