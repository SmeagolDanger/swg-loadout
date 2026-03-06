import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, LogIn, UserPlus } from 'lucide-react';

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', password: '', display_name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.username, form.password);
      } else {
        await register(form);
      }
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="card overflow-hidden">
          {/* Header */}
          <div className="px-8 pt-8 pb-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-plasma-500/15 border border-plasma-500/30 flex items-center justify-center mx-auto mb-4 animate-pulse-glow">
              <Shield size={32} className="text-plasma-400" />
            </div>
            <h1 className="font-display font-bold text-2xl text-hull-100 tracking-wider">
              {mode === 'login' ? 'WELCOME BACK' : 'CREATE ACCOUNT'}
            </h1>
            <p className="text-hull-300 text-sm mt-1">
              {mode === 'login' ? 'Sign in to access your loadouts' : 'Join the fleet and start building'}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex px-8">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2 text-sm font-display font-semibold tracking-wider border-b-2 transition-all
                ${mode === 'login' ? 'border-plasma-500 text-plasma-400' : 'border-transparent text-hull-300 hover:text-hull-200'}`}
            >
              <LogIn size={14} className="inline mr-1.5" />SIGN IN
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-2 text-sm font-display font-semibold tracking-wider border-b-2 transition-all
                ${mode === 'register' ? 'border-plasma-500 text-plasma-400' : 'border-transparent text-hull-300 hover:text-hull-200'}`}
            >
              <UserPlus size={14} className="inline mr-1.5" />REGISTER
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
            <div>
              <label className="block text-xs font-display font-semibold text-hull-300 tracking-wider mb-1.5">USERNAME</label>
              <input
                type="text" required
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                className="w-full"
                placeholder="pilot_name"
              />
            </div>

            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-display font-semibold text-hull-300 tracking-wider mb-1.5">EMAIL</label>
                  <input
                    type="email" required
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full"
                    placeholder="pilot@swg.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-display font-semibold text-hull-300 tracking-wider mb-1.5">DISPLAY NAME</label>
                  <input
                    type="text"
                    value={form.display_name}
                    onChange={e => setForm({ ...form, display_name: e.target.value })}
                    className="w-full"
                    placeholder="Your callsign"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-display font-semibold text-hull-300 tracking-wider mb-1.5">PASSWORD</label>
              <input
                type="password" required
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-laser-red/10 border border-laser-red/30 rounded-lg px-3 py-2 text-sm text-laser-red">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
