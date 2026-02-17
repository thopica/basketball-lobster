import { formatDistanceToNowStrict } from 'date-fns';

// Format relative time: "2h ago", "3d ago", etc.
export function timeAgo(dateString: string): string {
  try {
    return formatDistanceToNowStrict(new Date(dateString), { addSuffix: true });
  } catch {
    return '';
  }
}

// Hot ranking algorithm (HN-inspired)
// score = (votes + ai_score) / (hours_since_posted + 2) ^ gravity
export function calculateHotScore(
  votes: number,
  aiScore: number,
  createdAt: string,
  gravity: number = 1.5
): number {
  const hoursAge = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  return (votes + aiScore) / Math.pow(hoursAge + 2, gravity);
}

// Content type display config
export const CONTENT_TYPE_CONFIG = {
  article: {
    label: 'ARTICLE',
    color: 'badge-info',
    icon: '📄',
  },
  video: {
    label: 'VIDEO',
    color: 'badge-error',
    icon: '▶️',
  },
  podcast: {
    label: 'PODCAST',
    color: 'badge-secondary',
    icon: '🎙️',
  },
} as const;

// Truncate text to a max length
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '...';
}
