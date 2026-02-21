'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { ContentItem, Comment } from '@/lib/types';
import Header from '@/components/Header';
import ContentCard from '@/components/ContentCard';
import DetailView from '@/components/DetailView';
import AuthModal from '@/components/AuthModal';
import SubmitModal from '@/components/SubmitModal';

export default function HomePage() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('hot');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  // Modal states
  const [showAuth, setShowAuth] = useState<'login' | 'signup' | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);

  // Detail view
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [detailComments, setDetailComments] = useState<Comment[]>([]);

  const supabase = createClient();

  const loadProfile = useCallback(async (authUser: any) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (data) {
      setProfile(data);
      return;
    }

    // Profile missing -- ensure it exists via API (handles OAuth users
    // whose database trigger may not have fired)
    try {
      const res = await fetch('/api/profile', { method: 'POST' });
      if (res.ok) {
        const { profile: created } = await res.json();
        if (created) setProfile(created);
      }
    } catch {
      // API unreachable -- leave profile null, Header fallback will handle display
    }
  }, [supabase]);

  // Auth listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setUser(session.user);
          await loadProfile(session.user);
        } else {
          setUser(null);
          setProfile(null);
        }
      }
    );
    // Check initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        await loadProfile(session.user);
      }
    });
    return () => subscription.unsubscribe();
  }, [loadProfile]);

  // Fetch feed
  const fetchFeed = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sort,
        type: filter,
        page: page.toString(),
        limit: '30',
      });
      const res = await fetch(`/api/feed?${params}`);
      const data = await res.json();
      if (page === 1) {
        setItems(data.items || []);
      } else {
        setItems((prev) => [...prev, ...(data.items || [])]);
      }
      setHasMore(data.has_more);
    } catch (err) {
      console.error('Feed fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [sort, filter, page]);

  useEffect(() => {
    setPage(1);
  }, [sort, filter]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // Vote handler
  const handleVote = async (contentId: string) => {
    if (!user) {
      setShowAuth('login');
      return;
    }
    // Optimistic update
    setItems((prev) =>
      prev.map((item) =>
        item.id === contentId
          ? {
              ...item,
              user_voted: !item.user_voted,
              vote_count: item.vote_count + (item.user_voted ? -1 : 1),
            }
          : item
      )
    );
    if (selectedItem?.id === contentId) {
      setSelectedItem((prev) =>
        prev
          ? {
              ...prev,
              user_voted: !prev.user_voted,
              vote_count: prev.vote_count + (prev.user_voted ? -1 : 1),
            }
          : prev
      );
    }
    await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_id: contentId }),
    });
  };

  // Select item → load detail view
  const handleSelect = async (item: ContentItem) => {
    setSelectedItem(item);
    try {
      const res = await fetch(`/api/content/${item.id}`);
      const data = await res.json();
      setSelectedItem(data.content);
      setDetailComments(data.comments || []);
    } catch (err) {
      console.error('Detail fetch error:', err);
    }
  };

  // Comment handler
  const handleComment = async (body: string, parentId?: string) => {
    if (!user || !selectedItem) return;
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content_id: selectedItem.id,
        body,
        parent_id: parentId,
      }),
    });
    if (res.ok) {
      // Refresh comments
      const detailRes = await fetch(`/api/content/${selectedItem.id}`);
      const data = await detailRes.json();
      setDetailComments(data.comments || []);
      setSelectedItem(data.content);
    }
  };

  // Comment vote handler
  const handleCommentVote = async (commentId: string) => {
    if (!user) {
      setShowAuth('login');
      return;
    }
    await fetch('/api/comment-vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment_id: commentId }),
    });
    // Refresh comments
    if (selectedItem) {
      const res = await fetch(`/api/content/${selectedItem.id}`);
      const data = await res.json();
      setDetailComments(data.comments || []);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  // Detail view
  if (selectedItem) {
    return (
      <div className="min-h-screen bg-base-200">
        <header className="bg-base-100 border-b border-base-300 sticky top-0 z-50">
          <div className="max-w-2xl mx-auto px-4 flex items-center h-14">
            <a
              href="/"
              onClick={(e) => { e.preventDefault(); setSelectedItem(null); }}
              className="flex items-center gap-2 no-underline"
            >
              <span className="text-2xl">🦞</span>
              <span className="text-[17px] font-extrabold text-base-content tracking-tight">
                Basketball Lobster
              </span>
            </a>
          </div>
        </header>
        <div className="pt-2 pb-10">
          <DetailView
            item={selectedItem}
            comments={detailComments}
            user={user}
            onBack={() => setSelectedItem(null)}
            onVote={handleVote}
            onCommentVote={handleCommentVote}
            onComment={handleComment}
            onAuthClick={() => setShowAuth('login')}
          />
        </div>
        {showAuth && (
          <AuthModal
            mode={showAuth}
            onClose={() => setShowAuth(null)}
            onSuccess={() => fetchFeed()}
          />
        )}
      </div>
    );
  }

  // Feed view
  return (
    <div className="min-h-screen bg-base-200">
      <Header
        sort={sort}
        filter={filter}
        onSortChange={setSort}
        onFilterChange={setFilter}
        onSubmitClick={() => setShowSubmit(true)}
        onAuthClick={(mode) => setShowAuth(mode)}
        user={profile || (user ? { id: user.id, username: user.user_metadata?.username || user.email?.split('@')[0] || 'Account' } : null)}
        onLogout={handleLogout}
      />

      <div className="max-w-3xl mx-auto px-4 pt-3 pb-10">
        <div className="bg-base-100 rounded-xl border border-base-300 overflow-hidden">
          {loading && items.length === 0 ? (
            <div className="flex justify-center py-16">
              <span className="loading loading-spinner loading-md text-primary" />
            </div>
          ) : items.length > 0 ? (
            <>
              {items.map((item) => (
                <ContentCard
                  key={item.id}
                  item={item}
                  onVote={handleVote}
                  onSelect={handleSelect}
                />
              ))}
              {hasMore && (
                <div className="p-4 text-center">
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    className="btn btn-ghost btn-sm text-base-content/50"
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      'Load more'
                    )}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16 text-base-content/40">
              <p className="text-4xl mb-3">🦞</p>
              <p className="text-sm">No content yet. The lobster is out hunting for stories...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center py-6 text-base-content/30 text-xs">
          <p>AI-curated every 2 hours</p>
          <p className="mt-1">🦞 Basketball Lobster — The best basketball content, all in one feed.</p>
        </div>
      </div>

      {showAuth && (
        <AuthModal
          mode={showAuth}
          onClose={() => setShowAuth(null)}
          onSuccess={() => fetchFeed()}
        />
      )}
      {showSubmit && (
        <SubmitModal
          onClose={() => setShowSubmit(false)}
          user={user}
          onAuthClick={() => { setShowSubmit(false); setShowAuth('login'); }}
        />
      )}
    </div>
  );
}
