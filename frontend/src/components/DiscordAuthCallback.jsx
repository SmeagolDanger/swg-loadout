import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

const ERROR_MESSAGES = {
  access_denied: 'Discord sign-in was cancelled.',
  missing_code: 'Discord did not return a login code.',
  discord_not_configured: 'Discord login is not configured on this server.',
  token_exchange_failed: 'Discord login could not be completed.',
  discord_request_failed: 'Discord could not be reached right now.',
  discord_rate_limited: 'Discord is rate limiting login attempts right now. Please wait a moment and try again.',
  invalid_state: 'Discord sign-in expired or was interrupted. Please try again.',
  discord_identity_failed: 'Discord did not return a usable account identity.',
  discord_account_conflict: 'Discord sign-in could not be linked automatically. Sign in locally for now, then finish linking after the account rules are updated.',
};

export default function DiscordAuthCallback() {
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState('Completing Discord sign-in...');
  const navigate = useNavigate();
  const { completeOAuthLogin } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      setMessage(ERROR_MESSAGES[error] || 'Discord sign-in failed.');
      const timer = setTimeout(() => navigate('/auth', { replace: true }), 1800);
      return () => clearTimeout(timer);
    }

    if (!token) {
      setMessage('Discord sign-in did not return a session token.');
      const timer = setTimeout(() => navigate('/auth', { replace: true }), 1800);
      return () => clearTimeout(timer);
    }

    completeOAuthLogin(token)
      .then(() => navigate('/', { replace: true }))
      .catch((authError) => {
        if (authError?.status === 503 || authError?.status === 502 || authError?.status === 504) {
          setMessage('Signed in, but the site is still waking up. Redirecting…');
          setTimeout(() => navigate('/', { replace: true }), 1400);
          return;
        }
        setMessage('Discord sign-in could not finish.');
        setTimeout(() => navigate('/auth', { replace: true }), 1800);
      });
  }, [completeOAuthLogin, navigate, searchParams]);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="card max-w-md w-full p-8 text-center">
        <div className="w-12 h-12 border-2 border-plasma-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h1 className="font-display font-bold text-xl text-hull-100 tracking-wider mb-2">DISCORD SIGN-IN</h1>
        <p className="text-hull-200">{message}</p>
      </div>
    </div>
  );
}
