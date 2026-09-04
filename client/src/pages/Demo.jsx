import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth-context.jsx';
import { Logo } from '../components/Icons.jsx';

export default function Demo() {
  const { demoLogin } = useAuth() || {};
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!demoLogin) {
      setError('Demo login is not available');
      return undefined;
    }
    demoLogin()
      .then(() => {
        if (!cancelled) navigate('/dashboard', { replace: true });
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not open the live demo');
      });
    return () => { cancelled = true; };
  }, [demoLogin, navigate]);

  return (
    <div className="landing" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <div className="card" style={{ maxWidth: 420, textAlign: 'center' }}>
        <div className="brand" style={{ justifyContent: 'center', marginBottom: 12 }}><Logo /><span>Revsy</span></div>
        <h2 style={{ fontSize: 22 }}>{error ? 'Demo unavailable' : 'Opening live demo…'}</h2>
        <p className="sub" style={{ marginTop: 8 }}>
          {error || 'Loading the Smash Bros restaurant workspace for your client walkthrough.'}
        </p>
        {error ? (
          <button className="btn" style={{ marginTop: 16 }} onClick={() => navigate('/login')}>Go to login</button>
        ) : null}
      </div>
    </div>
  );
}
