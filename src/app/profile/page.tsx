'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { UserProfile } from '@/lib/types';

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      if (res.status === 401) {
        window.location.href = '/';
        return;
      }
      const data = await res.json();
      setProfile(data.profile);
      setEmail(data.email || '');
      setUsername(data.profile.username || '');
      setAvatarUrl(data.profile.avatar_url || '');
    } catch {
      setMessage({ text: 'Failed to load profile', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, avatar_url: avatarUrl || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error, type: 'error' });
        return;
      }
      setProfile(data.profile);
      setMessage({ text: 'Profile updated!', type: 'success' });
    } catch {
      setMessage({ text: 'Something went wrong', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    if (file.size > 2 * 1024 * 1024) {
      setMessage({ text: 'Image must be under 2MB', type: 'error' });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const ext = file.name.split('.').pop();
      const filePath = `${profile.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setAvatarUrl(`${publicUrl}?t=${Date.now()}`);
      setMessage({ text: 'Avatar uploaded! Click save to update your profile.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Upload failed', type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-md text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-base-content/50 mb-4">You need to be signed in to view your profile.</p>
          <a href="/" className="btn btn-primary btn-sm no-underline">Go Home</a>
        </div>
      </div>
    );
  }

  const hasChanges = username !== profile.username || (avatarUrl || '') !== (profile.avatar_url || '');

  return (
    <div className="min-h-screen bg-base-200">
      <header className="bg-base-100 border-b border-base-300 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 flex items-center justify-between h-14">
          <a href="/" className="flex items-center gap-2 no-underline">
            <span className="text-2xl">🦞</span>
            <span className="text-[17px] font-extrabold text-base-content tracking-tight">
              Basketball Lobster
            </span>
          </a>
          <a href="/" className="btn btn-ghost btn-sm text-base-content/50 no-underline">
            ← Back to feed
          </a>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="bg-base-100 rounded-xl border border-base-300 p-6">
          <h1 className="text-xl font-bold mb-6">Your Profile</h1>

          {/* Avatar */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="w-16 h-16 rounded-full object-cover border-2 border-base-300"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary border-2 border-base-300">
                  {(username || 'U')[0].toUpperCase()}
                </div>
              )}
              {uploading && (
                <div className="absolute inset-0 bg-base-100/80 rounded-full flex items-center justify-center">
                  <span className="loading loading-spinner loading-xs" />
                </div>
              )}
            </div>
            <div>
              <label className="btn btn-ghost btn-xs cursor-pointer">
                Change avatar
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </label>
              <p className="text-[10px] text-base-content/40 mt-0.5">PNG, JPG or WebP. Max 2MB.</p>
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-base-content/60 block mb-1">Email</label>
              <input
                type="email"
                value={email}
                disabled
                className="input input-bordered input-sm w-full opacity-60"
              />
              <p className="text-[10px] text-base-content/40 mt-0.5">Email cannot be changed.</p>
            </div>

            <div>
              <label className="text-sm font-semibold text-base-content/60 block mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your-username"
                className="input input-bordered input-sm w-full"
                maxLength={30}
              />
              <p className="text-[10px] text-base-content/40 mt-0.5">
                Letters, numbers, hyphens, underscores. 2-30 characters.
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold text-base-content/60 block mb-1">Karma</label>
              <p className="text-sm text-base-content font-mono">{profile.karma}</p>
            </div>

            <div>
              <label className="text-sm font-semibold text-base-content/60 block mb-1">Member since</label>
              <p className="text-sm text-base-content">
                {new Date(profile.created_at).toLocaleDateString('en-US', {
                  year: 'numeric', month: 'long', day: 'numeric'
                })}
              </p>
            </div>
          </div>

          {message && (
            <div className={`text-sm rounded-lg px-3 py-2 mt-4 ${
              message.type === 'success' ? 'text-success bg-success/10' : 'text-error bg-error/10'
            }`}>
              {message.text}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="btn btn-primary btn-sm btn-block mt-6 font-semibold"
          >
            {saving && <span className="loading loading-spinner loading-xs" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
