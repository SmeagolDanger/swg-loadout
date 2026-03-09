import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

const TRANSIENT_AUTH_STATUSES = new Set([429, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isUnauthorized(error) {
  return error?.status === 401 || error?.status === 403;
}

function isTransient(error) {
  return TRANSIENT_AUTH_STATUSES.has(error?.status);
}

function decodeTokenSubject(token) {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = JSON.parse(atob(padded));
    const username = typeof decoded?.sub === 'string' ? decoded.sub : null;
    if (!username) return null;
    return {
      id: null,
      username,
      email: '',
      display_name: username,
      is_admin: false,
      role: 'user',
      auth_provider: 'discord',
      discord_username: username,
      discord_avatar: null,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('slt_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    localStorage.removeItem('slt_token');
    localStorage.removeItem('slt_user');
    setUser(null);
  }, []);

  const setSession = useCallback((token, nextUser) => {
    localStorage.setItem('slt_token', token);
    localStorage.setItem('slt_user', JSON.stringify(nextUser));
    setUser(nextUser);
    return nextUser;
  }, []);

  const fetchMeWithRetry = useCallback(async (attempts = 4) => {
    let lastError = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return await api.getMe();
      } catch (error) {
        lastError = error;
        if (!isTransient(error) || attempt === attempts - 1) {
          throw error;
        }
        await sleep(350 * (attempt + 1));
      }
    }
    throw lastError || new Error('Unable to load user');
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('slt_token');
    if (!token) {
      setLoading(false);
      return;
    }

    fetchMeWithRetry()
      .then((nextUser) => {
        localStorage.setItem('slt_user', JSON.stringify(nextUser));
        setUser(nextUser);
      })
      .catch((error) => {
        if (isUnauthorized(error)) {
          clearSession();
          return;
        }

        const saved = localStorage.getItem('slt_user');
        if (saved) {
          try {
            setUser(JSON.parse(saved));
            return;
          } catch {
            // fall through to provisional decode
          }
        }

        const provisional = decodeTokenSubject(token);
        if (provisional) {
          setUser(provisional);
        }
      })
      .finally(() => setLoading(false));
  }, [clearSession, fetchMeWithRetry]);

  const login = async (username, password) => {
    const data = await api.login(username, password);
    return setSession(data.access_token, data.user);
  };

  const register = async (formData) => {
    const data = await api.register(formData);
    return setSession(data.access_token, data.user);
  };

  const completeOAuthLogin = useCallback(async (token) => {
    localStorage.setItem('slt_token', token);
    try {
      const nextUser = await fetchMeWithRetry();
      localStorage.setItem('slt_user', JSON.stringify(nextUser));
      setUser(nextUser);
      return nextUser;
    } catch (error) {
      if (isUnauthorized(error)) {
        clearSession();
        throw error;
      }

      const provisional = decodeTokenSubject(token);
      if (provisional) {
        localStorage.setItem('slt_user', JSON.stringify(provisional));
        setUser(provisional);
        return provisional;
      }

      throw error;
    }
  }, [clearSession, fetchMeWithRetry]);

  const logout = () => {
    clearSession();
  };

  const value = useMemo(
    () => ({ user, login, register, logout, loading, completeOAuthLogin }),
    [completeOAuthLogin, loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
