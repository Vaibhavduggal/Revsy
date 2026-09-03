import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, getToken, setToken } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [business, setBusiness] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (getToken()) {
      Promise.all([api.settings(), api.onboardingStatus().catch(() => ({ onboardingCompleted: true }))])
        .then(([s, o]) => setBusiness({
          id: getToken(),
          name: s.businessName,
          ...s,
          onboardingCompleted: o.onboardingCompleted,
          googleConnected: o.googleConnected,
          isDemo: s.isDemo || false,
        }))
        .catch(() => { setToken(null); })
        .finally(() => setReady(true));
    } else {
      setReady(true);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.login(email, password);
    setToken(data.token);
    setBusiness({ id: data.token, ...data.business });
    return data.business;
  }, []);

  const demoLogin = useCallback(async () => {
    const data = await api.demoLogin();
    setToken(data.token);
    setBusiness({ id: data.token, ...data.business });
    return data.business;
  }, []);

  const logout = useCallback(() => {
    api.logout().catch(() => {});
    setToken(null);
    setBusiness(null);
  }, []);

  return (
    <AuthContext.Provider value={{ business, setBusiness, ready, login, demoLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
