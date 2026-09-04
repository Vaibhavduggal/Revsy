import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../api.js';
import { Logo } from '../components/Icons.jsx';

function parseHashTokens() {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return {};
  return Object.fromEntries(new URLSearchParams(hash));
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const hash = parseHashTokens();
        const query = new URLSearchParams(window.location.search);
        if (hash.error || query.get('error')) {
          throw new Error(hash.error_description || query.get('error_description') || 'Google sign-in was cancelled');
        }
        const accessToken = hash.access_token;
        const oauthState = query.get('state');
        const businessName = sessionStorage.getItem('revsy_google_business_name') || query.get('businessName') || '';

        if (!accessToken) {
          throw new Error('Google sign-in did not complete. Try again.');
        }

        const data = await api.authSupabase({
          accessToken,
          businessName: businessName || undefined,
          oauthState: oauthState || undefined,
        });

        sessionStorage.removeItem('revsy_google_business_name');
        setToken(data.token);

        if (data.startGbpOAuth) {
          window.location.href = `/api/auth/google?token=${encodeURIComponent(data.token)}`;
          return;
        }

        if (!cancelled) {
          navigate(data.business?.onboardingCompleted ? '/dashboard' : '/onboarding', { replace: true });
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Sign-in failed');
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="landing" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <div className="card" style={{ maxWidth: 420, textAlign: 'center' }}>
        <div className="brand" style={{ justifyContent: 'center', marginBottom: 12 }}><Logo /><span>Revsy</span></div>
        <h2 style={{ fontSize: 22 }}>{error ? 'Sign-in failed' : 'Finishing Google sign-in…'}</h2>
        <p className="sub" style={{ marginTop: 8 }}>
          {error || 'Connecting your account and requesting Google review permissions next.'}
        </p>
        {error ? (
          <button className="btn" style={{ marginTop: 16 }} onClick={() => navigate('/login')}>Back to login</button>
        ) : null}
      </div>
    </div>
  );
}
