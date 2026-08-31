import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { adminApi, getAdminToken, setAdminToken } from './api.js';

// Fully separate from the client business auth-context: its own token key, its own
// localStorage slot, its own login endpoint. A client owner logging in never touches
// this, and an admin session can't be used to authenticate as a client business.
const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (getAdminToken()) {
      // No "whoami" endpoint yet — treat presence of a token as logged in; any
      // protected admin call will 401 and bounce back to /admin/login if it's stale.
      setAdmin({ token: getAdminToken() });
    }
    setReady(true);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await adminApi.login(email, password);
    setAdminToken(data.token);
    setAdmin({ ...data.admin, token: data.token });
    return data.admin;
  }, []);

  const logout = useCallback(() => {
    adminApi.logout().catch(() => {});
    setAdminToken(null);
    setAdmin(null);
  }, []);

  return (
    <AdminAuthContext.Provider value={{ admin, ready, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}
