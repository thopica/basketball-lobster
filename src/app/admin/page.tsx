'use client';

import { useState, useEffect, useCallback } from 'react';
import { ContentItem } from '@/lib/types';
import { CONTENT_TYPE_CONFIG, timeAgo, decodeHtml } from '@/lib/utils';

type StatusTab = 'review' | 'unpublished' | 'published' | 'all';

interface Stats {
  review: number;
  unpublished: number;
  published: number;
  all: number;
}

export default function AdminPage() {
  const [secret, setSecret] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState(false);

  const [stats, setStats] = useState<Stats>({ review: 0, unpublished: 0, published: 0, all: 0 });
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<StatusTab>('review');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }),
    [secret]
  );

  const handleLogin = async () => {
    setAuthError(false);
    try {
      const res = await fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${secret}` } });
      if (res.ok) {
        sessionStorage.setItem('admin_secret', secret);
        setAuthenticated(true);
      } else {
        setAuthError(true);
      }
    } catch {
      setAuthError(true);
    }
  };

  useEffect(() => {
    const saved = sessionStorage.getItem('admin_secret');
    if (saved) {
      setSecret(saved);
      fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${saved}` } })
        .then((r) => r.ok && setAuthenticated(true))
        .catch(() => {});
    }
  }, []);

  const fetchStats = useCallback(async () => {
    const res = await fetch('/api/admin/stats', { headers: authHeaders() });
    if (res.ok) setStats(await res.json());
  }, [authHeaders]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: tab, type: typeFilter, page: page.toString(), limit: '50' });
      const res = await fetch(`/api/admin/content?${params}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setTotal(data.total || 0);
        setHasMore(data.has_more);
      }
    } finally {
      setLoading(false);
    }
  }, [tab, typeFilter, page, authHeaders]);

  useEffect(() => {
    if (authenticated) {
      fetchStats();
      fetchItems();
    }
  }, [authenticated, fetchStats, fetchItems]);

  useEffect(() => {
    setPage(1);
  }, [tab, typeFilter]);

  const handleAction = async (action: 'approve', id: string) => {
    setActionLoading((prev) => new Set(prev).add(id));
    await fetch('/api/admin/content', {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ id, action }),
    });
    setItems((prev) => prev.filter((item) => item.id !== id));
    setTotal((prev) => prev - 1);
    setActionLoading((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    fetchStats();
  };

  const handleDelete = async (id: string) => {
    setActionLoading((prev) => new Set(prev).add(id));
    await fetch('/api/admin/content', {
      method: 'DELETE',
      headers: authHeaders(),
      body: JSON.stringify({ id }),
    });
    setItems((prev) => prev.filter((item) => item.id !== id));
    setTotal((prev) => prev - 1);
    setActionLoading((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    fetchStats();
  };

  const handleBulkApprove = async () => {
    const ids = items.map((i) => i.id);
    if (ids.length === 0) return;
    setLoading(true);
    await fetch('/api/admin/content', {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ ids, action: 'approve' }),
    });
    await fetchStats();
    await fetchItems();
  };

  const handleBulkDelete = async () => {
    const ids = items.map((i) => i.id);
    if (ids.length === 0) return;
    setLoading(true);
    await fetch('/api/admin/content', {
      method: 'DELETE',
      headers: authHeaders(),
      body: JSON.stringify({ ids }),
    });
    await fetchStats();
    await fetchItems();
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_secret');
    setAuthenticated(false);
    setSecret('');
  };

  // --- Password gate ---
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="bg-base-100 rounded-xl border border-base-300 p-8 w-full max-w-sm shadow-lg">
          <div className="text-center mb-6">
            <span className="text-4xl">🦞</span>
            <h1 className="text-xl font-extrabold mt-2">Admin Access</h1>
            <p className="text-sm text-base-content/50 mt-1">Enter admin secret to continue</p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
          >
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Admin secret"
              className={`input input-bordered w-full mb-3 ${authError ? 'input-error' : ''}`}
              autoFocus
            />
            {authError && <p className="text-error text-xs mb-3">Invalid secret. Try again.</p>}
            <button type="submit" className="btn btn-neutral w-full">
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Admin dashboard ---
  const TABS: { key: StatusTab; label: string; count: number }[] = [
    { key: 'review', label: 'Needs Review', count: stats.review },
    { key: 'unpublished', label: 'Rejected by AI', count: stats.unpublished },
    { key: 'published', label: 'Published', count: stats.published },
    { key: 'all', label: 'All', count: stats.all },
  ];

  const TYPE_FILTERS = [
    { key: 'all', label: 'All Types' },
    { key: 'article', label: 'Articles' },
    { key: 'video', label: 'Videos' },
    { key: 'podcast', label: 'Podcasts' },
  ];

  return (
    <div className="min-h-screen bg-base-200">
      {/* Header */}
      <header className="bg-base-100 border-b border-base-300 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2 no-underline">
              <span className="text-2xl">🦞</span>
              <span className="text-[17px] font-extrabold text-base-content tracking-tight">Admin</span>
            </a>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" className="btn btn-sm btn-ghost">
              View Site
            </a>
            <button onClick={handleLogout} className="btn btn-sm btn-ghost text-error">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 pt-4 pb-10">
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-3 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`btn btn-sm ${tab === t.key ? 'btn-neutral' : 'btn-ghost text-base-content/50'}`}
            >
              {t.label}
              <span className="badge badge-sm ml-1 font-mono">{t.count}</span>
            </button>
          ))}
        </div>

        {/* Filters + bulk actions bar */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex gap-1">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setTypeFilter(f.key)}
                className={`btn btn-xs ${
                  typeFilter === f.key ? 'btn-primary btn-outline' : 'btn-ghost text-base-content/50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {(tab === 'review' || tab === 'unpublished') && items.length > 0 && (
              <button onClick={handleBulkApprove} className="btn btn-xs btn-success btn-outline">
                Approve All ({items.length})
              </button>
            )}
            {(tab === 'review' || tab === 'unpublished') && items.length > 0 && (
              <button onClick={handleBulkDelete} className="btn btn-xs btn-error btn-outline">
                Delete All ({items.length})
              </button>
            )}
          </div>
        </div>

        {/* Content count */}
        <p className="text-xs text-base-content/40 mb-2 font-mono">
          Showing {items.length} of {total} items
          {page > 1 && ` (page ${page})`}
        </p>

        {/* Content list */}
        <div className="bg-base-100 rounded-xl border border-base-300 overflow-hidden">
          {loading && items.length === 0 ? (
            <div className="flex justify-center py-16">
              <span className="loading loading-spinner loading-md text-primary" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-base-content/40">
              <p className="text-sm">No items in this category.</p>
            </div>
          ) : (
            items.map((item) => (
              <AdminContentRow
                key={item.id}
                item={item}
                isLoading={actionLoading.has(item.id)}
                showApprove={tab !== 'published'}
                onApprove={() => handleAction('approve', item.id)}
                onDelete={() => handleDelete(item.id)}
              />
            ))
          )}
        </div>

        {/* Pagination */}
        {(hasMore || page > 1) && (
          <div className="flex justify-center gap-2 mt-4">
            {page > 1 && (
              <button onClick={() => setPage((p) => p - 1)} className="btn btn-sm btn-ghost">
                Previous
              </button>
            )}
            {hasMore && (
              <button onClick={() => setPage((p) => p + 1)} className="btn btn-sm btn-ghost">
                Next
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AdminContentRow({
  item,
  isLoading,
  showApprove,
  onApprove,
  onDelete,
}: {
  item: ContentItem;
  isLoading: boolean;
  showApprove: boolean;
  onApprove: () => void;
  onDelete: () => void;
}) {
  const typeConfig = CONTENT_TYPE_CONFIG[item.content_type];

  return (
    <div className={`flex gap-3 px-4 py-3 border-b border-base-200 ${isLoading ? 'opacity-40' : ''}`}>
      {/* AI score badge */}
      <div className="flex flex-col items-center justify-center min-w-[44px]">
        <span
          className={`text-lg font-black font-mono ${
            (item.ai_quality_score || 0) >= 8
              ? 'text-success'
              : (item.ai_quality_score || 0) >= 5
              ? 'text-warning'
              : 'text-error'
          }`}
        >
          {item.ai_quality_score || '?'}
        </span>
        <span className="text-[9px] text-base-content/30 font-mono">AI</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className={`text-[10px] font-extrabold tracking-wider font-mono px-1.5 py-0.5 rounded ${
              item.content_type === 'article'
                ? 'bg-info/10 text-info'
                : item.content_type === 'video'
                ? 'bg-error/10 text-error'
                : 'bg-secondary/10 text-secondary'
            }`}
          >
            {typeConfig.label}
          </span>
          <span className="text-xs text-base-content/40 font-mono">{timeAgo(item.created_at)}</span>
          <span className="text-xs text-base-content/30">{item.source_name}</span>
        </div>

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[14px] font-semibold text-base-content hover:text-primary transition-colors leading-snug block mb-0.5 no-underline"
        >
          {decodeHtml(item.headline)}
        </a>

        {item.summary && (
          <p className="text-[12px] text-base-content/50 leading-relaxed mb-1 line-clamp-2">{item.summary}</p>
        )}

        {item.ai_score_reason && (
          <p className="text-[11px] text-base-content/30 italic">AI: {item.ai_score_reason}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-xs btn-ghost btn-square"
          title="Open link"
        >
          ↗
        </a>
        {showApprove && (
          <button
            onClick={onApprove}
            disabled={isLoading}
            className="btn btn-xs btn-success btn-outline"
            title="Approve"
          >
            ✓
          </button>
        )}
        <button
          onClick={onDelete}
          disabled={isLoading}
          className="btn btn-xs btn-error btn-outline"
          title="Delete permanently"
        >
          🗑
        </button>
      </div>
    </div>
  );
}
