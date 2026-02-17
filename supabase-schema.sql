-- ============================================
-- Basketball Lobster — Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================

-- 1. USER PROFILES (extends Supabase auth)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  karma INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      'user_' || LEFT(NEW.id::text, 8)
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. CONTENT SOURCES (crawl configuration)
CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  crawl_type TEXT NOT NULL CHECK (crawl_type IN ('rss', 'youtube_api', 'podcast_rss')),
  content_type TEXT NOT NULL CHECK (content_type IN ('article', 'video', 'podcast')),
  tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 4),
  crawl_interval_minutes INTEGER DEFAULT 180,
  last_crawled_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  config JSONB DEFAULT '{}'
);

-- 3. CONTENT ITEMS (the feed)
CREATE TABLE content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT UNIQUE NOT NULL,
  headline TEXT NOT NULL,
  summary TEXT,
  source_name TEXT NOT NULL,
  author TEXT,
  content_type TEXT NOT NULL CHECK (content_type IN ('article', 'video', 'podcast')),
  thumbnail_url TEXT,
  ai_quality_score DECIMAL(3,1),
  ai_score_reason TEXT,
  vote_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  is_user_submitted BOOLEAN DEFAULT FALSE,
  submitted_by UUID REFERENCES profiles(id),
  published BOOLEAN DEFAULT TRUE,
  needs_review BOOLEAN DEFAULT FALSE,
  source_published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. VOTES
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content_id UUID REFERENCES content(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, content_id)
);

-- 5. COMMENTS
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES content(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  vote_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. COMMENT VOTES
CREATE TABLE comment_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, comment_id)
);

-- 7. CRAWL LOG
CREATE TABLE crawl_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES sources(id),
  items_found INTEGER DEFAULT 0,
  items_new INTEGER DEFAULT 0,
  items_published INTEGER DEFAULT 0,
  errors JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_content_published_created ON content(published, created_at DESC);
CREATE INDEX idx_content_type ON content(content_type);
CREATE INDEX idx_content_vote_count ON content(vote_count DESC);
CREATE INDEX idx_content_needs_review ON content(needs_review) WHERE needs_review = TRUE;
CREATE INDEX idx_content_pending ON content(published) WHERE published = FALSE;
CREATE INDEX idx_comments_content_id ON comments(content_id);
CREATE INDEX idx_comments_parent_id ON comments(parent_id);
CREATE INDEX idx_votes_content_id ON votes(content_id);
CREATE INDEX idx_votes_user_content ON votes(user_id, content_id);
CREATE INDEX idx_comment_votes_user ON comment_votes(user_id, comment_id);

-- ============================================
-- FUNCTIONS (vote count triggers)
-- ============================================

-- Auto-update content vote_count
CREATE OR REPLACE FUNCTION update_content_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE content SET vote_count = vote_count + 1, updated_at = NOW() WHERE id = NEW.content_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE content SET vote_count = vote_count - 1, updated_at = NOW() WHERE id = OLD.content_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_vote_change
  AFTER INSERT OR DELETE ON votes
  FOR EACH ROW EXECUTE FUNCTION update_content_vote_count();

-- Auto-update comment vote_count
CREATE OR REPLACE FUNCTION update_comment_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE comments SET vote_count = vote_count + 1 WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE comments SET vote_count = vote_count - 1 WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_comment_vote_change
  AFTER INSERT OR DELETE ON comment_votes
  FOR EACH ROW EXECUTE FUNCTION update_comment_vote_count();

-- Auto-update content comment_count
CREATE OR REPLACE FUNCTION update_content_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE content SET comment_count = comment_count + 1, updated_at = NOW() WHERE id = NEW.content_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE content SET comment_count = comment_count - 1, updated_at = NOW() WHERE id = OLD.content_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_comment_change
  AFTER INSERT OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_content_comment_count();

-- Auto-update user karma when their content gets voted
CREATE OR REPLACE FUNCTION update_user_karma()
RETURNS TRIGGER AS $$
DECLARE
  content_author UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT submitted_by INTO content_author FROM content WHERE id = NEW.content_id;
    IF content_author IS NOT NULL THEN
      UPDATE profiles SET karma = karma + 1 WHERE id = content_author;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT submitted_by INTO content_author FROM content WHERE id = OLD.content_id;
    IF content_author IS NOT NULL THEN
      UPDATE profiles SET karma = karma - 1 WHERE id = content_author;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_vote_karma
  AFTER INSERT OR DELETE ON votes
  FOR EACH ROW EXECUTE FUNCTION update_user_karma();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_log ENABLE ROW LEVEL SECURITY;

-- Profiles: anyone can read, users can update own
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Content: published items are viewable by everyone
CREATE POLICY "Published content viewable by everyone" ON content FOR SELECT USING (published = true);
CREATE POLICY "Service role can manage all content" ON content FOR ALL USING (auth.role() = 'service_role');

-- Votes: anyone can read, authenticated users can manage own
CREATE POLICY "Votes viewable by everyone" ON votes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can vote" ON votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own votes" ON votes FOR DELETE USING (auth.uid() = user_id);

-- Comments: anyone can read, authenticated users can create
CREATE POLICY "Comments viewable by everyone" ON comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can comment" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can edit own comments" ON comments FOR UPDATE USING (auth.uid() = user_id);

-- Comment votes: same as content votes
CREATE POLICY "Comment votes viewable by everyone" ON comment_votes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can vote on comments" ON comment_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own comment votes" ON comment_votes FOR DELETE USING (auth.uid() = user_id);

-- Sources: only service role
CREATE POLICY "Service role manages sources" ON sources FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Sources readable by service role" ON sources FOR SELECT USING (auth.role() = 'service_role');

-- Crawl log: only service role
CREATE POLICY "Service role manages crawl log" ON crawl_log FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- SEED DATA: Content Sources (Tier 1-4)
-- ============================================
INSERT INTO sources (name, url, crawl_type, content_type, tier, crawl_interval_minutes, config) VALUES
-- Tier 1: Major outlets
('ESPN NBA', 'https://www.espn.com/espn/rss/nba/news', 'rss', 'article', 1, 120, '{}'),
('The Athletic NBA', 'https://theathletic.com/feeds/rss/nba/', 'rss', 'article', 1, 120, '{}'),
('Bleacher Report NBA', 'https://bleacherreport.com/articles/feed?tag_id=19', 'rss', 'article', 1, 120, '{}'),
('The Ringer NBA', 'https://www.theringer.com/rss/nba/index.xml', 'rss', 'article', 1, 120, '{}'),
('NBA.com News', 'https://www.nba.com/feeds/nba-rss-feed', 'rss', 'article', 1, 120, '{}'),

-- Tier 2: Quality depth
('HoopsHype', 'https://hoopshype.com/feed/', 'rss', 'article', 2, 180, '{}'),
('SB Nation NBA', 'https://www.sbnation.com/nba/rss/current', 'rss', 'article', 2, 180, '{}'),
('Yahoo Sports NBA', 'https://sports.yahoo.com/nba/rss/', 'rss', 'article', 2, 180, '{}'),

-- Tier 3: Video (YouTube channels)
('Thinking Basketball', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCL7DDQWP6x7wy0O6L5ZIgA', 'youtube_api', 'video', 3, 180, '{"channel_id": "UCL7DDQWP6x7wy0O6L5ZIgA"}'),
('JxmyHighroller', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCbM7qIlNSMt_cftAMDfkMNA', 'youtube_api', 'video', 3, 180, '{"channel_id": "UCbM7qIlNSMt_cftAMDfkMNA"}'),
('KOT4Q', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCGwVjGihcKaZbOOzIcYerGQ', 'youtube_api', 'video', 3, 180, '{"channel_id": "UCGwVjGihcKaZbOOzIcYerGQ"}'),

-- Tier 3: Podcasts
('The Lowe Post', 'https://feeds.megaphone.fm/ESP5765452710', 'podcast_rss', 'podcast', 3, 180, '{}'),
('All the Smoke', 'https://feeds.megaphone.fm/allthesmoke', 'podcast_rss', 'podcast', 3, 180, '{}'),

-- Tier 4: Hot takes (YouTube)
('Undisputed', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCuTGrdmihGEhCIaAqiLZBeg', 'youtube_api', 'video', 4, 180, '{"channel_id": "UCuTGrdmihGEhCIaAqiLZBeg"}'),
('First Take', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCFjOi1ZpZVErr8EYxg8t1dQ', 'youtube_api', 'video', 4, 180, '{"channel_id": "UCFjOi1ZpZVErr8EYxg8t1dQ"}');
