import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

const TRANSIENT_AUTH_STATUSES = new Set([0, 429, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isUnauthorized(error) {
  return error?.status === 401 || error?.status === 403;
}

function isTransient(error) {
  return TRANSIENT_AUTH_STATUSES.has(error?.status);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(async ({ remote = false } = {}) => {
    if (remote) {
      try {
        await api.logout();
      } catch {
        // ignore logout transport failures
      }
    }
    setUser(null);
  }, []);

  const fetchMeWithRetry = useCallback(async (attempts = 7) => {
    let lastError = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return await api.getMe();
      } catch (error) {
        lastError = error;
        if (!isTransient(error) || attempt === attempts - 1) {
          throw error;
        }
        await sleep(Math.min(500 * (attempt + 1), 2500));
      }
    }
    throw lastError || new Error('Unable to load user');
  }, []);

  useEffect(() => {
    fetchMeWithRetry()
      .then((nextUser) => {
        setUser(nextUser);
      })
      .catch((error) => {
        if (isUnauthorized(error)) {
          clearSession();
          return;
        }
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [clearSession, fetchMeWithRetry]);

  const login = async (username, password) => {
    const data = await api.login(username, password);
    setUser(data.user);
    return data.user;
  };

  const register = async (formData) => {
    const data = await api.register(formData);
    setUser(data.user);
    return data.user;
  };

  const completeOAuthLogin = useCallback(async () => {
    const nextUser = await fetchMeWithRetry();
    setUser(nextUser);
    return nextUser;
  }, [fetchMeWithRetry]);

  const logout = async () => {
    await clearSession({ remote: true });
  };

  const value = useMemo(
    () => ({ user, login, register, logout, loading, completeOAuthLogin }),
    [completeOAuthLogin, loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
