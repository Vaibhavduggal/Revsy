import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth-context.jsx';
import { Icon, Logo } from '../components/Icons.jsx';
import GoogleSignIn from '../components/GoogleSignIn.jsx';
import { useToast } from '../components/useToast.jsx';

export default function Login() {
  const { login, demoLogin } = useAuth();
  const navigate = useNavigate();
  const { show, node } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const goAfterLogin = (biz) => {
    if (biz?.onboardingCompleted || biz?.isDemo) navigate('/dashboard');
    else navigate('/onboarding');
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const biz = await login(email, password);
      show(`Welcome back, ${biz.name}!`);
      goAfterLogin(biz);
    } catch (err) {
      show(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const viewDemo = async () => {
    setDemoLoading(true);
    try {
      const biz = await demoLogin();
      show(`Viewing the live demo for ${biz.name}`);
      navigate('/dashboard');
    } catch (err) {
      show(err.message || 'Could not load demo');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="landing" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'radial-gradient(900px 400px at 50% -10%, var(--accent-soft), #fff)' }}>
      <div className="card" style={{ width: '100%', maxWidth: 380 }}>
        <div className="brand" style={{ justifyContent: 'center', marginBottom: 8 }}><Logo /><span>Revsy</span></div>
        <h2 style={{ textAlign: 'center', fontSize: 22 }}>Business login</h2>
        <p className="sub" style={{ textAlign: 'center', marginBottom: 18 }}>Sign in to your review dashboard</p>

        <GoogleSignIn label="Continue with Google" onError={show} />

        <div className="flex" style={{ alignItems: 'center', gap: 10, margin: '16px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          <span className="csv-hint">or email</span>
          <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <label>Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourbusiness.com" required autoFocus />
          </div>
          <div className="field">
            <label>Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <button className="btn" style={{ width: '100%' }} type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="flex" style={{ alignItems: 'center', gap: 10, margin: '16px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          <span className="csv-hint">or</span>
          <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        </div>

        <button type="button" className="btn secondary" style={{ width: '100%' }} onClick={viewDemo} disabled={demoLoading}>
          <Icon.play width={16} height={16} /> {demoLoading ? 'Loading demo…' : 'View live demo'}
        </button>
        <div className="csv-hint" style={{ textAlign: 'center', marginTop: 10 }}>
          New gym or restaurant? <a href="/signup">Create an account</a>
        </div>
      </div>
      {node}
    </div>
  );
}
