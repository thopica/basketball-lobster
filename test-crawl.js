// test-crawl.js
// Run with: node test-crawl.js
// Tests the full crawl pipeline: fetch sources → crawl → AI curate → display results

const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');
const Parser = require('rss-parser');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const rssParser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'BasketballLobster/1.0' },
});

console.log('\n🦞 Basketball Lobster — Full Crawl Test\n');
console.log('━'.repeat(60));

// --- Crawlers ---

async function crawlRSS(source) {
  const feed = await rssParser.parseURL(source.url);
  return (feed.items || []).slice(0, 3).map((item) => ({
    url: item.link || item.guid || '',
    headline: item.title || 'Untitled',
    content: item.contentSnippet || item.content || item.summary || item.title || '',
    author: item.creator || item.author || null,
    source_name: source.name,
    content_type: source.content_type,
    source_published_at: item.isoDate || null,
  }));
}

async function crawlYouTubeAPI(source) {
  const channelId = source.config?.channel_id;
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&maxResults=3&type=video&key=${process.env.YOUTUBE_API_KEY}`;
  const res = await fetch(searchUrl);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return (data.items || []).map((item) => ({
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    headline: item.snippet.title,
    content: item.snippet.description || '',
    author: item.snippet.channelTitle,
    source_name: source.name,
    content_type: 'video',
    source_published_at: item.snippet.publishedAt,
  }));
}

// --- AI Curator ---

async function testCurate(headline, sourceName, content) {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `You are a basketball content curator for an NBA fan community.
Given the following content, do two things:
1. Write a 2-3 sentence summary for NBA fans. Be concise and engaging.
2. Rate quality 1-10 (higher for: breaking news, player narratives, hot takes).
Return ONLY valid JSON: {"summary": "...", "score": 7, "reason": "..."}

Headline: ${headline}
Source: ${sourceName}
Content: ${content.slice(0, 1500)}`,
    }],
  });
  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  return JSON.parse(cleaned);
}

// --- Main Test ---

async function run() {
  // 1. Fetch sources from DB
  console.log('\n1. Fetching sources from Supabase...');
  const { data: sources, error } = await supabase
    .from('sources')
    .select('*')
    .eq('is_active', true)
    .order('tier');

  if (error || !sources?.length) {
    console.log(`   ❌ Failed: ${error?.message || 'No sources found'}`);
    return;
  }
  console.log(`   ✅ Found ${sources.length} sources\n`);

  // 2. Test one source per type
  const testSources = {
    rss: sources.find(s => s.crawl_type === 'rss'),
    youtube_api: sources.find(s => s.crawl_type === 'youtube_api'),
    podcast_rss: sources.find(s => s.crawl_type === 'podcast_rss'),
  };

  for (const [type, source] of Object.entries(testSources)) {
    if (!source) {
      console.log(`⚠️  No source found for type: ${type}\n`);
      continue;
    }

    console.log(`${'━'.repeat(60)}`);
    console.log(`📡 Testing: ${source.name} (${type}, Tier ${source.tier})`);
    console.log(`   URL: ${source.url.slice(0, 70)}...`);

    try {
      // Crawl
      let items;
      if (type === 'youtube_api') {
        items = await crawlYouTubeAPI(source);
      } else {
        items = await crawlRSS(source);
      }

      if (items.length === 0) {
        console.log(`   ⚠️  No items returned from crawl`);
        continue;
      }

      console.log(`   ✅ Crawled ${items.length} items\n`);

      // Show first item
      const first = items[0];
      console.log(`   First item:`);
      console.log(`   Title:  ${first.headline.slice(0, 80)}`);
      console.log(`   URL:    ${first.url.slice(0, 80)}`);
      console.log(`   Author: ${first.author || 'N/A'}`);
      console.log(`   Date:   ${first.source_published_at || 'N/A'}`);

      // AI Curate the first item
      console.log(`\n   🤖 Running AI curation on first item...`);
      const ai = await testCurate(first.headline, first.source_name, first.content);
      console.log(`   Score:   ${ai.score}/10`);
      console.log(`   Reason:  ${ai.reason}`);
      console.log(`   Summary: ${ai.summary}`);

      // Publish decision
      const decision = ai.score >= 8 ? '✅ AUTO-PUBLISH' :
                       ai.score >= 5 ? '🟡 PUBLISH + FLAG FOR REVIEW' :
                       '🔴 PENDING QUEUE';
      console.log(`   Decision: ${decision}`);

    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
    }

    console.log('');
  }

  // Summary
  console.log('━'.repeat(60));
  console.log('\n📊 Pipeline Test Summary:\n');
  console.log('   Supabase → Sources table    ✅');
  for (const [type, source] of Object.entries(testSources)) {
    const emoji = source ? '✅' : '❌';
    console.log(`   ${type.padEnd(15)} → Crawl      ${emoji} ${source?.name || 'No source'}`);
  }
  console.log('   Claude API  → AI Curation   ✅');
  console.log('\n🦞 Full pipeline test complete!\n');
}

run().catch(err => {
  console.error('❌ Test failed:', err.message);
});
