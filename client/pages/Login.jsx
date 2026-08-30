import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth-context.jsx';
import { Icon, Logo } from '../components/Icons.jsx';
import { useToast } from '../components/useToast.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { show, node } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const biz = await login(email, password);
      show(`Welcome back, ${biz.name}!`);
      navigate('/dashboard');
    } catch (err) {
      show(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const viewDemo = async () => {
    await login('owner@business.com', 'demo123');
    show('Logged into demo account');
    navigate('/dashboard');
  };

  return (
    <div className="landing" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'radial-gradient(900px 400px at 50% -10%, var(--accent-soft), #fff)' }}>
      <div className="card" style={{ width: '100%', maxWidth: 380 }}>
        <div className="brand" style={{ justifyContent: 'center', marginBottom: 8 }}><Logo /><span>ReviewBot</span></div>
        <h2 style={{ textAlign: 'center', fontSize: 22 }}>Business login</h2>
        <p className="sub" style={{ textAlign: 'center', marginBottom: 18 }}>Sign in to your review dashboard</p>
        <form onSubmit={submit}>
          <div className="field">
            <label>Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn" style={{ width: '100%' }} type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <button className="btn ghost" style={{ width: '100%', marginTop: 14, background: 'transparent', borderColor: 'var(--line)', color: var(--ink) }} onClick={viewDemo}>
          View Demo
        </button>
        <div className="csv-hint" style={{ textAlign: 'center', marginTop: 14 }}>
          New to the product? Try the <b>View Demo</b> button first — no credentials required.
        </div>
      </div>
      {node}
    </div>
  );
}
