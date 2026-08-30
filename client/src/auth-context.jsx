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
    setBusiness({ id: data.business.id, name: data.business.name, ...data.business });
    return data.business;
}, []);

  const loginAdmin = useCallback(async (email, password) => {
    const data = await api.adminLogin(email, password);
    setToken(data.token);
    setAdmin(true);
    setBusiness({ id: data.business.id, name: data.business.name, ...data.business, isAdmin: data.business.isAdmin });
    return data.business;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setBusiness(null);
    setAdmin(false);
  }, []);

  return (
    <AuthContext.Provider value={{ business, setBusiness, admin, setAdmin, ready, login, loginAdmin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useAdmin() {
  const ctx = useContext(AuthContext);
  return { admin, setAdmin, loginAdmin, logout };
}

export function useAuth() {
  return useContext(AuthContext);
}
