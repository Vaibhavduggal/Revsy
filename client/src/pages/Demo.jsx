import { useEffect, useState } from 'react';
import { Rise } from 'cube-motion/react';
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
    <div className="editorial-shell" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <Rise as="div" className="card glass-card" style={{ maxWidth: 420, textAlign: 'center', width: '100%' }}>
        <div className="brand" style={{ justifyContent: 'center', marginBottom: 12 }}><Logo /><span>Revsy</span></div>
        <h2 style={{ fontSize: 22 }}>{error ? 'Demo unavailable' : 'Opening live demo…'}</h2>
        <p className="sub" style={{ marginTop: 8 }}>
          {error || 'Loading the Smash Bros restaurant workspace for your client walkthrough.'}
        </p>
        {error ? (
          <button className="btn" style={{ marginTop: 16 }} onClick={() => navigate('/login')}>Go to login</button>
        ) : (
          <div className="skeleton" style={{ height: 6, marginTop: 20, borderRadius: 999 }} aria-hidden="true" />
        )}
      </Rise>
    </div>
  );
}
