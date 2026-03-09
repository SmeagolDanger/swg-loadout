import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getMeWithRetry() {
  let lastError = null;
  for (const delay of [0, 400, 900, 1600]) {
    if (delay) {
      await wait(delay);
    }
    try {
      return await api.getMe();
    } catch (error) {
      lastError = error;
      if (error?.status !== 503) {
        throw error;
      }
    }
  }
  throw lastError || new Error('Authentication service is temporarily unavailable.');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('slt_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  const setSession = (token, nextUser) => {
    localStorage.setItem('slt_token', token);
    localStorage.setItem('slt_user', JSON.stringify(nextUser));
    setUser(nextUser);
    return nextUser;
  };

  useEffect(() => {
    const token = localStorage.getItem('slt_token');
    if (token) {
      getMeWithRetry()
        .then((u) => {
          setUser(u);
          localStorage.setItem('slt_user', JSON.stringify(u));
        })
        .catch(() => {
          localStorage.removeItem('slt_token');
          localStorage.removeItem('slt_user');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const data = await api.login(username, password);
    return setSession(data.access_token, data.user);
  };

  const register = async (formData) => {
    const data = await api.register(formData);
    return setSession(data.access_token, data.user);
  };

  const completeOAuthLogin = async (token) => {
    localStorage.setItem('slt_token', token);
    try {
      const nextUser = await getMeWithRetry();
      localStorage.setItem('slt_user', JSON.stringify(nextUser));
      setUser(nextUser);
      return nextUser;
    } catch (error) {
      localStorage.removeItem('slt_token');
      localStorage.removeItem('slt_user');
      setUser(null);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('slt_token');
    localStorage.removeItem('slt_user');
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, login, register, logout, loading, completeOAuthLogin }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
