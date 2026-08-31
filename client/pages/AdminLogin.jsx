export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../src/auth-context.jsx';
import { useToast } from '../src/components/useToast.jsx';

export default function AdminLogin() {
  const { loginAdmin } = useAuth();
  const router = useRouter();
  const { show, node } = useToast();
  const [email, setEmail] = useState('admin@reviewbot.com');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await loginAdmin(email, password);
      show('Welcome, Admin!');
      router.push('/admin');
    } catch (err) {
      show(err.message || 'Admin login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'radial-gradient(900px 400px at 50% -10%, var(--accent-soft), #fff)' }}>
      <div className="card" style={{ width: '100%', maxWidth: 380 }}>
        <div className="brand" style={{ justifyContent: 'center', marginBottom: 8 }}><span>ReviewBot</span></div>
        <h2 style={{ textAlign: 'center', fontSize: 22 }}>Admin login</h2>
        <p className="sub" style={{ textAlign: 'center', marginBottom: 18 }}>Platform administrator login</p>
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
            {loading ? 'Logging in…' : 'Sign in'}
          </button>
        </form>
        <div className="csv-hint" style={{ textAlign: 'center', marginTop: 14 }}>
          Demo credentials: <b>admin@reviewbot.com</b> / <b>admin123</b>
        </div>
      </div>
      {node}
    </div>
  );
}