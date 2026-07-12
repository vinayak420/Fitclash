import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setAuthToken, getAuthToken } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = getAuthToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const me = await api.me();
        setUser(me);
      } catch (e) {
        setAuthToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    const { access_token } = await api.login(email, password);
    setAuthToken(access_token);
    const me = await api.me();
    setUser(me);
  }, []);

  const signup = useCallback(async (name, email, password) => {
    const { access_token } = await api.signup(name, email, password);
    setAuthToken(access_token);
    const me = await api.me();
    setUser(me);
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await api.me();
      setUser(me);
    } catch (e) {
      // ignore — token may have expired, next protected call will redirect to login
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
