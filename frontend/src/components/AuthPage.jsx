import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, LogIn, MessageSquare, Shield, UserPlus } from 'lucide-react';

import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', password: '', display_name: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState({ discord: false });
  const [discordBusy, setDiscordBusy] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.getAuthProviders().then(setProviders).catch(() => setProviders({ discord: false }));
  }, []);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.username, form.password);
        navigate('/');
      } else if (mode === 'register') {
        await register(form);
        navigate('/');
      } else {
        await api.forgotPassword(form.email);
        setSuccess('If that account exists, a password reset email has been sent.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startDiscordLogin = () => {
    setDiscordBusy(true);
    window.location.href = api.getDiscordLoginUrl();
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="card overflow-hidden">
          <div className="px-8 pt-8 pb-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-plasma-500/15 border border-plasma-500/30 flex items-center justify-center mx-auto mb-4 animate-pulse-glow">
              <Shield size={32} className="text-plasma-400" />
            </div>
            <h1 className="font-display font-bold text-2xl text-hull-100 tracking-wider">
              {mode === 'login' ? 'WELCOME BACK' : mode === 'register' ? 'CREATE ACCOUNT' : 'RESET PASSWORD'}
            </h1>
            <p className="text-hull-200 text-sm mt-1">
              {mode === 'login'
                ? 'Sign in to access your loadouts'
                : mode === 'register'
                  ? 'Join the fleet and start building'
                  : 'We will email you a password reset link'}
            </p>
          </div>

          <div className="flex px-8">
            <button
              onClick={() => switchMode('login')}
              className={`flex-1 py-2 text-sm font-display font-semibold tracking-wider border-b-2 transition-all ${
                mode === 'login'
                  ? 'border-plasma-500 text-plasma-400'
                  : 'border-transparent text-hull-200 hover:text-hull-100'
              }`}
            >
              <LogIn size={14} className="inline mr-1.5" />SIGN IN
            </button>
            <button
              onClick={() => switchMode('register')}
              className={`flex-1 py-2 text-sm font-display font-semibold tracking-wider border-b-2 transition-all ${
                mode === 'register'
                  ? 'border-plasma-500 text-plasma-400'
                  : 'border-transparent text-hull-200 hover:text-hull-100'
              }`}
            >
              <UserPlus size={14} className="inline mr-1.5" />REGISTER
            </button>
            <button
              onClick={() => switchMode('forgot')}
              className={`flex-1 py-2 text-sm font-display font-semibold tracking-wider border-b-2 transition-all ${
                mode === 'forgot'
                  ? 'border-plasma-500 text-plasma-400'
                  : 'border-transparent text-hull-200 hover:text-hull-100'
              }`}
            >
              <KeyRound size={14} className="inline mr-1.5" />RESET
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
            {mode !== 'forgot' && (
              <div>
                <label className="block text-xs font-display font-semibold text-hull-200 tracking-wider mb-1.5">
                  USERNAME
                </label>
                <input
                  type="text"
                  required
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full"
                  placeholder="pilot_name"
                />
              </div>
            )}

            {(mode === 'register' || mode === 'forgot') && (
              <div>
                <label className="block text-xs font-display font-semibold text-hull-200 tracking-wider mb-1.5">
                  EMAIL
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full"
                  placeholder="pilot@swg.com"
                />
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-display font-semibold text-hull-200 tracking-wider mb-1.5">
                  DISPLAY NAME
                </label>
                <input
                  type="text"
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  className="w-full"
                  placeholder="Your callsign"
                />
              </div>
            )}

            {mode !== 'forgot' && (
              <div>
                <label className="block text-xs font-display font-semibold text-hull-200 tracking-wider mb-1.5">
                  PASSWORD
                </label>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full"
                  placeholder="••••••••"
                />
              </div>
            )}

            {error && (
              <div className="bg-laser-red/10 border border-laser-red/30 rounded-lg px-3 py-2 text-sm text-laser-red">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-plasma-500/10 border border-plasma-500/30 rounded-lg px-3 py-2 text-sm text-plasma-300">
                {success}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Send Reset Link'}
            </button>

            {mode === 'login' && (
              <div className="text-center text-sm text-hull-200">
                <button type="button" className="text-plasma-400 hover:text-plasma-300" onClick={() => switchMode('forgot')}>
                  Forgot your password?
                </button>
              </div>
            )}

            {providers.discord && mode === 'login' && (
              <button type="button" onClick={startDiscordLogin} disabled={discordBusy} className="btn-ghost w-full py-3 justify-center">
                <MessageSquare size={16} /> {discordBusy ? 'Redirecting to Discord...' : 'Sign in with Discord'}
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
