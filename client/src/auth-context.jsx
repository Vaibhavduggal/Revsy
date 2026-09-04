import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, getToken, setToken } from './api.js';

const AuthContext = createContext(null);

function mergeBusiness(data, settings, onboarding) {
  return {
    id: data.business?.id || getToken(),
    ...data.business,
    name: data.business?.name || settings?.businessName,
    ...settings,
    onboardingCompleted: onboarding?.onboardingCompleted ?? data.business?.onboardingCompleted,
    googleConnected: onboarding?.googleConnected ?? data.business?.googleConnected,
    approvalStatus: onboarding?.approvalStatus ?? data.business?.approvalStatus,
    isDemo: settings?.isDemo || data.business?.isDemo || false,
  };
}

export function AuthProvider({ children }) {
  const [business, setBusiness] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (getToken()) {
      Promise.all([api.settings(), api.onboardingStatus().catch(() => ({ onboardingCompleted: true }))])
        .then(([s, o]) => setBusiness({
          id: s.businessId || getToken(),
          name: s.businessName,
          ...s,
          onboardingCompleted: o.onboardingCompleted,
          googleConnected: o.googleConnected,
          approvalStatus: o.approvalStatus,
          isDemo: s.isDemo || false,
        }))
        .catch(() => { setToken(null); })
        .finally(() => setReady(true));
    } else {
      setReady(true);
    }
  }, []);

  const afterAuth = useCallback(async (data) => {
    setToken(data.token);
    const [s, o] = await Promise.all([
      api.settings(),
      api.onboardingStatus().catch(() => ({ onboardingCompleted: false, googleConnected: false })),
    ]);
    const biz = mergeBusiness(data, s, o);
    setBusiness(biz);
    return biz;
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.login(email, password);
    return afterAuth(data);
  }, [afterAuth]);

  const signup = useCallback(async (email, password, businessName) => {
    const data = await api.signup(email, password, businessName);
    return afterAuth(data);
  }, [afterAuth]);

  const demoLogin = useCallback(async () => {
    const data = await api.demoLogin();
    return afterAuth(data);
  }, [afterAuth]);

  const logout = useCallback(() => {
    api.logout().catch(() => {});
    setToken(null);
    setBusiness(null);
  }, []);

  return (
    <AuthContext.Provider value={{ business, setBusiness, ready, login, signup, demoLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
