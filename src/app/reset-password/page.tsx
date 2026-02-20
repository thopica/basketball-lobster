'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  const handleReset = async () => {
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center px-4">
        <div className="bg-base-100 rounded-xl border border-base-300 p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-bold">Password updated</h1>
          <p className="text-sm text-base-content/50 mt-2">
            Your password has been reset successfully.
          </p>
          <a href="/" className="btn btn-primary btn-sm btn-block mt-6 font-semibold no-underline">
            Back to Basketball Lobster
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center px-4">
      <div className="bg-base-100 rounded-xl border border-base-300 p-8 max-w-sm w-full">
        <div className="text-center mb-6">
          <span className="text-3xl">🦞</span>
          <h1 className="text-xl font-bold mt-2">Set new password</h1>
          <p className="text-sm text-base-content/50 mt-1">Choose a new password for your account</p>
        </div>

        <div className="space-y-3">
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleReset()}
            className="input input-bordered input-sm w-full"
            autoFocus
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleReset()}
            className="input input-bordered input-sm w-full"
          />

          {error && (
            <div className="text-sm text-error bg-error/10 rounded-lg px-3 py-2">{error}</div>
          )}

          <button
            onClick={handleReset}
            disabled={loading || !password || !confirmPassword}
            className="btn btn-primary btn-block btn-sm font-semibold"
          >
            {loading && <span className="loading loading-spinner loading-xs" />}
            Update password
          </button>
        </div>
      </div>
    </div>
  );
}
