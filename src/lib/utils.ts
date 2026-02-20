import { formatDistanceToNowStrict } from 'date-fns';

// Format relative time: "2h ago", "3d ago", etc.
export function timeAgo(dateString: string): string {
  try {
    return formatDistanceToNowStrict(new Date(dateString), { addSuffix: true });
  } catch {
    return '';
  }
}

// Hot ranking algorithm
// Designed for a low-traffic NBA content aggregator where:
// - Recency matters most (breaking news, trades)
// - AI quality score provides a baseline floor
// - Community votes are rare early on but should be amplified when they exist
// - Different content types age at different rates
export function calculateHotScore(
  votes: number,
  aiScore: number,
  createdAt: string,
  contentType: 'article' | 'video' | 'podcast' = 'article'
): number {
  const hoursAge = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);

  // Recency boost: gives fresh content a significant but short-lived kick
  // This ensures breaking news rises to the top immediately
  let recencyBoost = 0;
  if (hoursAge < 1) recencyBoost = 10;
  else if (hoursAge < 3) recencyBoost = 5;
  else if (hoursAge < 6) recencyBoost = 2;

  // Base score: AI score is quality floor, votes are amplified community signal
  // AI score (1-10) * 2 = max 20 points from AI
  // Votes * 3 = community signal weighted higher per vote (but rare early on)
  const baseScore = (aiScore * 2) + (votes * 3) + recencyBoost;

  // Content-type-aware gravity
  // Lower gravity = slower decay = stays visible longer
  // Articles (news) decay fastest — news cycle is short
  // Videos decay slower — people watch on their own schedule
  // Podcasts decay slowest — listened over days during commutes
  const gravityMap: Record<string, number> = {
    article: 1.2,
    video: 0.8,
    podcast: 0.6,
  };
  const gravity = gravityMap[contentType] || 1.0;

  return baseScore / Math.pow(hoursAge + 2, gravity);
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

// Decode HTML entities (YouTube API returns encoded titles)
export function decodeHtml(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
    '&#39;': "'", '&#x27;': "'", '&apos;': "'", '&#x2F;': '/',
  };
  return text.replace(/&(?:#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m) => entities[m] || m);
}

// Truncate text to a max length
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '...';
}
