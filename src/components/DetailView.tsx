'use client';

import { useState } from 'react';
import { ContentItem, Comment } from '@/lib/types';
import { timeAgo, CONTENT_TYPE_CONFIG, decodeHtml } from '@/lib/utils';

interface DetailViewProps {
  item: ContentItem;
  comments: Comment[];
  user: any | null;
  onBack: () => void;
  onVote: (id: string) => void;
  onCommentVote: (id: string) => void;
  onComment: (body: string, parentId?: string) => void;
  onAuthClick: () => void;
}

function CommentThread({
  comment, depth, user, onVote, onReply, onAuthClick,
}: {
  comment: Comment; depth: number; user: any | null;
  onVote: (id: string) => void;
  onReply: (body: string, parentId: string) => void;
  onAuthClick: () => void;
}) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');

  const handleReply = () => {
    if (!user) { onAuthClick(); return; }
    if (!replyText.trim()) return;
    onReply(replyText, comment.id);
    setReplyText('');
    setShowReply(false);
  };

  return (
    <div className={depth > 0 ? 'pl-5 border-l-2 border-base-200 ml-3' : ''}>
      <div className="py-2.5 border-b border-base-200/50">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[13px] font-bold text-base-content">
            @{comment.profile?.username || 'anon'}
          </span>
          <span className="text-xs text-base-content/35">{timeAgo(comment.created_at)}</span>
          <button
            onClick={() => onVote(comment.id)}
            className="ml-auto text-xs text-base-content/35 hover:text-primary flex items-center gap-1"
          >
            <span className={comment.user_voted ? 'text-primary' : ''}>▲</span> {comment.vote_count}
          </button>
        </div>
        <p className="text-sm text-base-content/70 leading-relaxed">{comment.body}</p>
        <button
          onClick={() => { if (!user) onAuthClick(); else setShowReply(!showReply); }}
          className="text-xs text-base-content/30 hover:text-primary mt-1"
        >
          reply
        </button>
        {showReply && (
          <div className="flex gap-2 mt-2">
            <input
              type="text" placeholder="Write a reply..."
              value={replyText} onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleReply()}
              className="input input-bordered input-xs flex-1"
            />
            <button onClick={handleReply} className="btn btn-xs btn-primary">Post</button>
          </div>
        )}
      </div>
      {comment.replies?.map((reply) => (
        <CommentThread
          key={reply.id} comment={reply} depth={depth + 1}
          user={user} onVote={onVote} onReply={onReply} onAuthClick={onAuthClick}
        />
      ))}
    </div>
  );
}

export default function DetailView({
  item, comments, user, onBack, onVote, onCommentVote, onComment, onAuthClick,
}: DetailViewProps) {
  const [commentText, setCommentText] = useState('');
  const typeConfig = CONTENT_TYPE_CONFIG[item.content_type];

  const handleComment = () => {
    if (!user) { onAuthClick(); return; }
    if (!commentText.trim()) return;
    onComment(commentText);
    setCommentText('');
  };

  return (
    <div className="max-w-2xl mx-auto px-4">
      <button onClick={onBack} className="btn btn-ghost btn-sm gap-1 my-3 text-base-content/50">
        ← Back to feed
      </button>

      <div className="bg-base-100 rounded-xl border border-base-300 overflow-hidden">
        {/* Content header */}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className={`text-[10px] font-extrabold tracking-wider font-mono px-1.5 py-0.5 rounded ${
              item.content_type === 'article' ? 'bg-info/10 text-info' :
              item.content_type === 'video' ? 'bg-error/10 text-error' :
              'bg-secondary/10 text-secondary'
            }`}>
              {typeConfig.label}
            </span>
            <span className="text-[13px] text-base-content/50">
              {item.source_name} • {item.author} • {timeAgo(item.created_at)}
            </span>
          </div>

          <h1 className="text-xl font-bold text-base-content leading-snug mb-3">
            {decodeHtml(item.headline)}
          </h1>

          {item.summary && (
            <p className="text-[15px] text-base-content/60 leading-relaxed mb-4">
              {item.summary}
            </p>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-sm font-semibold gap-1 no-underline"
            >
              {item.content_type === 'video' ? '▶ Watch' :
               item.content_type === 'podcast' ? '🎧 Listen' : '📖 Read'}
              {' '}on {item.source_name} →
            </a>
            <button
              onClick={() => onVote(item.id)}
              className={`btn btn-sm btn-ghost gap-1 ${item.user_voted ? 'text-primary' : 'text-base-content/40'}`}
            >
              ▲ {item.vote_count}
            </button>
          </div>
        </div>

        {/* Comments section */}
        <div className="border-t border-base-300 p-5">
          <h3 className="text-sm font-bold mb-4">
            Comments ({item.comment_count})
          </h3>

          {/* New comment input */}
          <div className="flex gap-2 mb-5 bg-base-200 p-3 rounded-lg">
            <input
              type="text"
              placeholder={user ? 'Add a comment...' : 'Sign in to comment'}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleComment()}
              className="input input-bordered input-sm flex-1"
            />
            <button
              onClick={handleComment}
              disabled={!commentText.trim()}
              className="btn btn-sm btn-neutral font-semibold"
            >
              Post
            </button>
          </div>

          {/* Comment list */}
          {comments.length > 0 ? (
            comments.map((comment) => (
              <CommentThread
                key={comment.id} comment={comment} depth={0}
                user={user} onVote={onCommentVote}
                onReply={(body, parentId) => onComment(body, parentId)}
                onAuthClick={onAuthClick}
              />
            ))
          ) : (
            <p className="text-sm text-base-content/30 text-center py-6">
              No comments yet. Be the first!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
