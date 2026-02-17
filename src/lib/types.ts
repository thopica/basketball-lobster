// Content types
export type ContentType = 'article' | 'video' | 'podcast';

export interface ContentItem {
  id: string;
  url: string;
  headline: string;
  summary: string | null;
  source_name: string;
  author: string | null;
  content_type: ContentType;
  thumbnail_url: string | null;
  ai_quality_score: number | null;
  ai_score_reason: string | null;
  vote_count: number;
  comment_count: number;
  is_user_submitted: boolean;
  submitted_by: string | null;
  published: boolean;
  needs_review: boolean;
  source_published_at: string | null;
  created_at: string;
  updated_at: string;
  // Client-side enrichment
  user_voted?: boolean;
}

export interface Comment {
  id: string;
  content_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  vote_count: number;
  created_at: string;
  updated_at: string;
  // Joined data
  profile?: UserProfile;
  replies?: Comment[];
  user_voted?: boolean;
}

export interface UserProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  karma: number;
  created_at: string;
}

export interface Source {
  id: string;
  name: string;
  url: string;
  crawl_type: 'rss' | 'youtube_api' | 'podcast_rss';
  content_type: ContentType;
  tier: number;
  crawl_interval_minutes: number;
  last_crawled_at: string | null;
  is_active: boolean;
  config: Record<string, any> | null;
}

export interface CrawlLog {
  id: string;
  source_id: string;
  items_found: number;
  items_new: number;
  items_published: number;
  errors: any | null;
  started_at: string;
  completed_at: string | null;
}

// API request/response types
export interface FeedParams {
  sort: 'hot' | 'new' | 'top';
  type: ContentType | 'all';
  page: number;
  limit: number;
  top_period?: 'today' | 'week' | 'month';
}

export interface SubmitContentRequest {
  url: string;
  content_type: ContentType;
}

export interface VoteRequest {
  content_id: string;
}

export interface CommentRequest {
  content_id: string;
  body: string;
  parent_id?: string;
}

export interface AIResponse {
  summary: string;
  score: number;
  reason: string;
}
