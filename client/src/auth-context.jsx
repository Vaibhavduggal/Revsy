import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, getToken, setToken } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [business, setBusiness] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Session is the business id we received at login.
    if (getToken()) {
      api.settings()
        .then((s) => setBusiness({
          id: getToken(),
          name: s.businessName,
          ...s,
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

  const logout = useCallback(() => {
    setToken(null);
    setBusiness(null);
  }, []);

  return (
    <AuthContext.Provider value={{ business, setBusiness, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
