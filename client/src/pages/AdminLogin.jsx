import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../admin-auth-context.jsx';
import { Icon, Logo } from '../components/Icons.jsx';
import { useToast } from '../components/useToast.jsx';

export default function AdminLogin() {
  const { login } = useAdminAuth();
  const navigate = useNavigate();
  const { show, node } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate('/admin');
    } catch (err) {
      show(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'radial-gradient(900px 400px at 50% -10%, #eef2ff, #fff)' }}>
      <div className="card" style={{ width: '100%', maxWidth: 380 }}>
        <div className="brand" style={{ justifyContent: 'center', marginBottom: 8 }}><Logo /><span>Revsy Admin</span></div>
        <h2 style={{ textAlign: 'center', fontSize: 22 }}>Platform login</h2>
        <p className="sub" style={{ textAlign: 'center', marginBottom: 18 }}>For Revsy staff only — manage client accounts</p>
        <form onSubmit={submit}>
          <div className="field">
            <label>Admin email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label>Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn" style={{ width: '100%' }} type="submit" disabled={loading}>
            {loading ? 'Signing in…' : <><Icon.shield width={16} height={16} /> Sign in</>}
          </button>
        </form>
      </div>
      {node}
    </div>
  );
}
