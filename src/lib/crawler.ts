import Parser from 'rss-parser';
import { Source, ContentType } from './types';

const rssParser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'BasketballLobster/1.0 (content aggregator)',
  },
});

export interface CrawledItem {
  url: string;
  headline: string;
  content: string; // Description or full text for AI processing
  author: string | null;
  source_name: string;
  content_type: ContentType;
  thumbnail_url: string | null;
  source_published_at: string | null;
}

// Crawl an RSS feed (articles and podcasts)
async function crawlRSS(source: Source): Promise<CrawledItem[]> {
  try {
    const feed = await rssParser.parseURL(source.url);
    return (feed.items || []).slice(0, 20).map((item) => ({
      url: item.link || item.guid || '',
      headline: item.title || 'Untitled',
      content: item.contentSnippet || item.content || item.summary || item.title || '',
      author: item.creator || item.author || null,
      source_name: source.name,
      content_type: source.content_type,
      thumbnail_url: extractThumbnail(item),
      source_published_at: item.isoDate || item.pubDate || null,
    }));
  } catch (error) {
    console.error(`RSS crawl error for ${source.name}:`, error);
    return [];
  }
}

// Crawl YouTube channel via Data API v3
async function crawlYouTubeAPI(source: Source): Promise<CrawledItem[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const channelId = source.config?.channel_id;

  if (!apiKey || !channelId) {
    console.error(`YouTube API: Missing API key or channel_id for ${source.name}`);
    return [];
  }

  try {
    // Fetch recent videos from channel
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
      `part=snippet&channelId=${channelId}&order=date&maxResults=10&type=video&key=${apiKey}`;

    const res = await fetch(searchUrl, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();

    if (data.error) {
      console.error(`YouTube API error for ${source.name}:`, data.error.message);
      return [];
    }

    if (!data.items || data.items.length === 0) {
      return [];
    }

    return data.items.map((item: any) => ({
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      headline: item.snippet.title || 'Untitled',
      content: item.snippet.description || item.snippet.title || '',
      author: item.snippet.channelTitle || null,
      source_name: source.name,
      content_type: 'video' as ContentType,
      thumbnail_url:
        item.snippet.thumbnails?.high?.url ||
        item.snippet.thumbnails?.medium?.url ||
        item.snippet.thumbnails?.default?.url ||
        null,
      source_published_at: item.snippet.publishedAt || null,
    }));
  } catch (error) {
    console.error(`YouTube API crawl error for ${source.name}:`, error);
    return [];
  }
}

// Extract thumbnail from RSS item
function extractThumbnail(item: any): string | null {
  if (item.enclosure?.url && item.enclosure?.type?.startsWith('image')) {
    return item.enclosure.url;
  }
  if (item['media:thumbnail']?.$.url) {
    return item['media:thumbnail'].$.url;
  }
  if (item['media:content']?.$.url && item['media:content']?.$.medium === 'image') {
    return item['media:content'].$.url;
  }
  const imgMatch = (item.content || '').match(/<img[^>]+src="([^"]+)"/);
  if (imgMatch) return imgMatch[1];
  return null;
}

// Main crawl function — dispatches to correct crawler based on source type
export async function crawlSource(source: Source): Promise<CrawledItem[]> {
  switch (source.crawl_type) {
    case 'rss':
      return crawlRSS(source);
    case 'youtube_api':
      return crawlYouTubeAPI(source);
    case 'podcast_rss':
      return crawlRSS(source);
    default:
      console.error(`Unknown crawl type: ${source.crawl_type}`);
      return [];
  }
}
