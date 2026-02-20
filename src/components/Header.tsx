'use client';

import { ContentType } from '@/lib/types';

interface HeaderProps {
  sort: string;
  filter: string;
  onSortChange: (sort: string) => void;
  onFilterChange: (filter: string) => void;
  onSubmitClick: () => void;
  onAuthClick: (mode: 'login' | 'signup') => void;
  user: any | null;
  onLogout: () => void;
}

const SORTS = ['hot', 'new'];
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'article', label: 'Articles' },
  { key: 'video', label: 'Videos' },
  { key: 'podcast', label: 'Podcasts' },
];

export default function Header({
  sort, filter, onSortChange, onFilterChange,
  onSubmitClick, onAuthClick, user, onLogout,
}: HeaderProps) {
  return (
    <header className="bg-base-100 border-b border-base-300 sticky top-0 z-50">
      <div className="max-w-3xl mx-auto px-4">
        {/* Top row: logo + auth */}
        <div className="flex items-center justify-between h-14">
          <a href="/" className="flex items-center gap-2 no-underline">
            <span className="text-2xl">🦞</span>
            <span className="text-[17px] font-extrabold text-base-content tracking-tight">
              Basketball Lobster
            </span>
          </a>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <button onClick={onSubmitClick} className="btn btn-sm btn-ghost font-semibold">
                  Submit
                </button>
                <div className="dropdown dropdown-end">
                  <label tabIndex={0} className="btn btn-sm btn-ghost font-semibold gap-1.5">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt=""
                        className="w-5 h-5 rounded-full object-cover"
                      />
                    ) : (
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                        {(user.username || 'U')[0].toUpperCase()}
                      </span>
                    )}
                    {user.username || 'Account'}
                  </label>
                  <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-40 border border-base-300">
                    <li><a href="/profile" className="no-underline">Profile</a></li>
                    <li><button onClick={onLogout}>Sign Out</button></li>
                  </ul>
                </div>
              </>
            ) : (
              <>
                <button onClick={onSubmitClick} className="btn btn-sm btn-ghost font-semibold">
                  Submit
                </button>
                <button onClick={() => onAuthClick('login')} className="btn btn-sm btn-neutral font-semibold">
                  Sign In
                </button>
              </>
            )}
          </div>
        </div>

        {/* Bottom row: sort + filter */}
        <div className="flex items-center justify-between pb-2 gap-2 flex-wrap">
          <div className="flex gap-0.5">
            {SORTS.map((s) => (
              <button
                key={s}
                onClick={() => onSortChange(s)}
                className={`btn btn-xs capitalize ${
                  sort === s ? 'btn-neutral' : 'btn-ghost text-base-content/50'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => onFilterChange(f.key)}
                className={`btn btn-xs ${
                  filter === f.key ? 'btn-primary btn-outline' : 'btn-ghost text-base-content/50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
