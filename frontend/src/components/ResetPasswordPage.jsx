import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound } from 'lucide-react';

import { api } from '../api';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!token) {
      setError('Password reset link is missing or invalid.');
      return;
    }
    if (password.length < 8) {
      setError('Choose a password with at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const result = await api.resetPasswordWithToken(token, password);
      setSuccess(result.detail || 'Password updated successfully. Redirecting to sign in...');
      setTimeout(() => navigate('/auth', { replace: true }), 1600);
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
          <div className="px-8 pt-8 pb-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-plasma-500/15 border border-plasma-500/30 flex items-center justify-center mx-auto mb-4">
              <KeyRound size={32} className="text-plasma-400" />
            </div>
            <h1 className="font-display font-bold text-2xl text-hull-100 tracking-wider">RESET PASSWORD</h1>
            <p className="text-hull-200 text-sm mt-1">Choose a new password for your Jawatracks account</p>
          </div>
          <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
            <div>
              <label className="block text-xs font-display font-semibold text-hull-200 tracking-wider mb-1.5">NEW PASSWORD</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-xs font-display font-semibold text-hull-200 tracking-wider mb-1.5">CONFIRM PASSWORD</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full"
                placeholder="••••••••"
              />
            </div>
            {error && <div className="bg-laser-red/10 border border-laser-red/30 rounded-lg px-3 py-2 text-sm text-laser-red">{error}</div>}
            {success && <div className="bg-plasma-500/10 border border-plasma-500/30 rounded-lg px-3 py-2 text-sm text-plasma-300">{success}</div>}
            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
