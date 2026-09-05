import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../api.js';
import { Logo } from '../components/Icons.jsx';

function parseHashTokens() {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return {};
  return Object.fromEntries(new URLSearchParams(hash));
}

function formatAuthError(message, code) {
  if (code === 'access_denied' || /testing mode|test user|verification/i.test(message || '')) {
    return {
      title: 'Google access blocked',
      body: message || 'This Google app is in Testing mode. Add your Gmail as a test user in Google Cloud Console → OAuth consent screen → Test users, then try again.',
      hint: 'After sign-in works, connect Google Business Profile on the onboarding screen (that step uses a separate permission).',
    };
  }
  return {
    title: 'Sign-in failed',
    body: message || 'Google sign-in did not complete.',
    hint: null,
  };
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const hash = parseHashTokens();
        const query = new URLSearchParams(window.location.search);
        const errCode = query.get('code') || hash.error || query.get('error') || '';

        if (query.get('error') || hash.error) {
          const msg = query.get('error') || hash.error_description || query.get('error_description') || 'Google sign-in was cancelled';
          const code = query.get('code') || hash.error || query.get('error') || '';
          if (!cancelled) setError(formatAuthError(msg, code));
          return;
        }

        const directToken = query.get('token');
        if (directToken) {
          setToken(directToken);
          sessionStorage.removeItem('revsy_google_business_name');
          const next = query.get('next') || '/onboarding';
          window.location.href = next;
          return;
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
        if (!cancelled) setError(formatAuthError(err.message, 'error'));
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="editorial-shell" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="card" style={{ maxWidth: 480, textAlign: 'center' }}>
        <div className="brand" style={{ justifyContent: 'center', marginBottom: 12 }}><Logo /><span>Revsy</span></div>
        <h2 style={{ fontSize: 22 }}>{error ? error.title : 'Finishing Google sign-in…'}</h2>
        <p className="sub" style={{ marginTop: 8, textAlign: 'left' }}>
          {error ? error.body : 'Signing you in with Google. Business Profile access is connected on the next onboarding step.'}
        </p>
        {error?.hint ? <p className="csv-hint" style={{ marginTop: 10, textAlign: 'left' }}>{error.hint}</p> : null}
        {error ? (
          <div className="flex col" style={{ gap: 8, marginTop: 16 }}>
            <button className="btn" onClick={() => navigate('/login')}>Back to login</button>
            <button className="btn secondary" onClick={() => navigate('/signup')}>Try email sign-up</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
