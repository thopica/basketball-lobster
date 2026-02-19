'use client';

import { ContentItem } from '@/lib/types';
import { timeAgo, CONTENT_TYPE_CONFIG, decodeHtml } from '@/lib/utils';

interface ContentCardProps {
  item: ContentItem;
  onVote: (id: string) => void;
  onSelect: (item: ContentItem) => void;
}

export default function ContentCard({ item, onVote, onSelect }: ContentCardProps) {
  const typeConfig = CONTENT_TYPE_CONFIG[item.content_type];

  return (
    <div className="flex gap-2 px-4 py-3.5 border-b border-base-200 hover:bg-base-200/50 transition-colors">
      {/* Vote button */}
      <button
        onClick={() => onVote(item.id)}
        className="flex flex-col items-center gap-0.5 pt-1 min-w-[44px] group"
      >
        <svg
          width="14" height="9" viewBox="0 0 14 9" fill="none"
          className={`transition-colors ${
            item.user_voted ? 'fill-primary' : 'fill-base-content/25 group-hover:fill-primary/60'
          }`}
        >
          <path d="M7 0L13.5 9H0.5L7 0Z" />
        </svg>
        <span
          className={`text-xs font-bold font-mono tabular-nums ${
            item.user_voted ? 'text-primary' : 'text-base-content/40'
          }`}
        >
          {item.vote_count}
        </span>
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Badge + time */}
        <div className="flex items-center gap-2 mb-1">
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
          <span className="text-xs text-base-content/40 font-mono">
            {timeAgo(item.created_at)}
          </span>
        </div>

        {/* Headline */}
        <a
          href={item.url}
          onClick={(e) => {
            e.preventDefault();
            onSelect(item);
          }}
          className="text-[15px] font-semibold text-base-content hover:text-primary transition-colors leading-snug block mb-1 no-underline"
        >
          {decodeHtml(item.headline)}
        </a>

        {/* Summary */}
        {item.summary && (
          <p className="text-[13.5px] text-base-content/60 leading-relaxed mb-1.5 max-w-xl">
            {item.summary}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-base-content/40">
            <span className="font-semibold text-base-content/55">{item.source_name}</span>
            {item.author && <> • {item.author}</>}
          </span>
          <button
            onClick={() => onSelect(item)}
            className="text-xs text-base-content/40 hover:text-primary transition-colors flex items-center gap-1"
          >
            💬 {item.comment_count} comments
          </button>
        </div>
      </div>
    </div>
  );
}
