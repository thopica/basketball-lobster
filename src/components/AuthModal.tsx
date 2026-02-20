'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase-browser';

type AuthMode = 'login' | 'signup' | 'reset' | 'check-email';

interface AuthModalProps {
  mode: 'login' | 'signup';
  onClose: () => void;
  onSuccess: () => void;
}

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: 'Weak', color: 'bg-error' };
  if (score <= 2) return { score, label: 'Fair', color: 'bg-warning' };
  if (score <= 3) return { score, label: 'Good', color: 'bg-info' };
  return { score, label: 'Strong', color: 'bg-success' };
}

function friendlyError(message: string): string {
  const map: Record<string, string> = {
    'Invalid login credentials': 'Wrong email or password. Please try again.',
    'User already registered': 'This email is already registered. Try signing in instead.',
    'Email not confirmed': 'Please check your email and confirm your account first.',
    'Password should be at least 6 characters': 'Password must be at least 6 characters.',
    'Unable to validate email address: invalid format': 'Please enter a valid email address.',
    'Signup requires a valid password': 'Please enter a password.',
  };
  return map[message] || message;
}

export default function AuthModal({ mode: initialMode, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkEmailMessage, setCheckEmailMessage] = useState('');

  const emailRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    const timer = setTimeout(() => emailRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, [mode]);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: username || `user_${Date.now()}` },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (signUpError) throw signUpError;
        setCheckEmailMessage('Check your email for a confirmation link to activate your account.');
        setMode('check-email');
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(friendlyError(err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError('');
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      });
      if (error) throw error;
      setCheckEmailMessage('Check your email for a password reset link.');
      setMode('check-email');
    } catch (err: any) {
      setError(friendlyError(err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(friendlyError(error.message));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      if (mode === 'reset') handleResetPassword();
      else if (mode === 'login' || mode === 'signup') handleSubmit();
    }
  };

  const strength = password ? getPasswordStrength(password) : null;

  if (mode === 'check-email') {
    return (
      <div className="modal modal-open" onClick={onClose}>
        <div className="modal-box max-w-sm" onClick={(e) => e.stopPropagation()}>
          <div className="text-center py-4">
            <div className="text-5xl mb-4">✉️</div>
            <h3 className="text-lg font-bold text-base-content">Check your email</h3>
            <p className="text-sm text-base-content/60 mt-2 leading-relaxed">
              {checkEmailMessage}
            </p>
            <p className="text-xs text-base-content/40 mt-3">
              Sent to <span className="font-semibold text-base-content/60">{email}</span>
            </p>
          </div>
          <div className="mt-4 space-y-2">
            <button onClick={onClose} className="btn btn-primary btn-block btn-sm font-semibold">
              Got it
            </button>
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className="btn btn-ghost btn-block btn-sm text-base-content/50"
            >
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'reset') {
    return (
      <div className="modal modal-open" onClick={onClose}>
        <div className="modal-box max-w-sm" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-lg font-bold">Reset password</h3>
          <p className="text-sm text-base-content/50 mt-1">
            Enter your email and we&apos;ll send a reset link
          </p>
          <div className="mt-4 space-y-3" onKeyDown={handleKeyDown}>
            <input
              ref={emailRef}
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input input-bordered input-sm w-full"
            />
            {error && (
              <div className="text-sm text-error bg-error/10 rounded-lg px-3 py-2">{error}</div>
            )}
            <button
              onClick={handleResetPassword}
              disabled={loading || !email}
              className="btn btn-primary btn-block btn-sm font-semibold"
            >
              {loading && <span className="loading loading-spinner loading-xs" />}
              Send reset link
            </button>
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className="btn btn-ghost btn-block btn-sm text-base-content/50"
            >
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal modal-open" onClick={onClose}>
      <div className="modal-box max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold">
          {mode === 'login' ? 'Welcome back' : 'Join Basketball Lobster'}
        </h3>
        <p className="text-sm text-base-content/50 mt-1">
          {mode === 'login'
            ? 'Sign in to vote, comment, and submit content'
            : 'Create an account to join the community'}
        </p>

        <div className="mt-4">
          <button onClick={handleGoogleLogin} className="btn btn-outline btn-block gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="divider text-xs text-base-content/30">or</div>

          <div className="space-y-3" onKeyDown={handleKeyDown}>
            {mode === 'signup' && (
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input input-bordered input-sm w-full"
              />
            )}
            <input
              ref={emailRef}
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input input-bordered input-sm w-full"
            />
            <div>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input input-bordered input-sm w-full"
              />
              {mode === 'signup' && password && strength && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-base-300 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                      style={{ width: `${(strength.score / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-base-content/50">
                    {strength.label}
                  </span>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="text-sm text-error bg-error/10 rounded-lg px-3 py-2 mt-3">{error}</div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !email || !password}
            className="btn btn-primary btn-block btn-sm mt-4 font-semibold"
          >
            {loading && <span className="loading loading-spinner loading-xs" />}
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          {mode === 'login' && (
            <button
              onClick={() => { setMode('reset'); setError(''); }}
              className="btn btn-ghost btn-xs btn-block mt-1 text-base-content/40"
            >
              Forgot password?
            </button>
          )}

          <p className="text-center text-xs text-base-content/40 mt-4">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
              className="text-primary font-semibold"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>

          {mode === 'signup' && (
            <p className="text-center text-[10px] text-base-content/30 mt-3">
              By creating an account you agree to our community guidelines.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
