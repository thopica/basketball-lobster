import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';
import { crawlSource, CrawledItem } from '@/lib/crawler';
import { curateContent } from '@/lib/ai-curator';
import { Source } from '@/lib/types';

export const maxDuration = 60; // Allow up to 60s for Vercel serverless
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Verify cron secret (protect endpoint)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const results: any[] = [];

  try {
    // Get all active sources that are due for crawling
    const { data: sources, error: sourcesError } = await supabase
      .from('sources')
      .select('*')
      .eq('is_active', true);

    if (sourcesError || !sources) {
      return NextResponse.json({ error: 'Failed to fetch sources', details: sourcesError }, { status: 500 });
    }

    for (const source of sources as Source[]) {
      // Check if source is due for crawling
      if (source.last_crawled_at) {
        const lastCrawled = new Date(source.last_crawled_at).getTime();
        const intervalMs = source.crawl_interval_minutes * 60 * 1000;
        if (Date.now() - lastCrawled < intervalMs) {
          continue; // Skip, not due yet
        }
      }

      const logEntry = {
        source_id: source.id,
        items_found: 0,
        items_new: 0,
        items_published: 0,
        errors: null as any,
        started_at: new Date().toISOString(),
        completed_at: null as string | null,
      };

      try {
        // Step 1: Crawl
        const crawledItems = await crawlSource(source);
        logEntry.items_found = crawledItems.length;

        for (const item of crawledItems) {
          if (!item.url || !item.headline) continue;

          // Step 2: Deduplicate (check if URL exists)
          const { data: existing } = await supabase
            .from('content')
            .select('id')
            .eq('url', item.url)
            .single();

          if (existing) continue; // Already have this item

          // Step 3: AI Curation (summary + score)
          const aiResult = await curateContent(
            item.headline,
            item.source_name,
            item.content
          );

          // Step 4: Determine publish status based on score
          const published = aiResult.score >= 5;
          const needsReview = aiResult.score >= 5 && aiResult.score <= 7;

          // Step 5: Insert into database
          const { error: insertError } = await supabase.from('content').insert({
            url: item.url,
            headline: item.headline,
            summary: aiResult.summary,
            source_name: item.source_name,
            author: item.author,
            content_type: item.content_type,
            thumbnail_url: item.thumbnail_url,
            ai_quality_score: aiResult.score,
            ai_score_reason: aiResult.reason,
            published,
            needs_review: needsReview,
            source_published_at: item.source_published_at,
          });

          if (insertError) {
            console.error(`Insert error for ${item.url}:`, insertError);
            continue;
          }

          logEntry.items_new++;
          if (published) logEntry.items_published++;
        }
      } catch (error: any) {
        logEntry.errors = { message: error.message };
        console.error(`Crawl error for ${source.name}:`, error);
      }

      logEntry.completed_at = new Date().toISOString();

      // Update source last_crawled_at
      await supabase
        .from('sources')
        .update({ last_crawled_at: new Date().toISOString() })
        .eq('id', source.id);

      // Log crawl results
      await supabase.from('crawl_log').insert(logEntry);
      results.push({ source: source.name, ...logEntry });
    }

    return NextResponse.json({
      success: true,
      sources_processed: results.length,
      results,
    });
  } catch (error: any) {
    console.error('Crawl cron error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Also allow GET for manual testing
export async function GET(request: NextRequest) {
  // For manual trigger, check for secret in query params
  const secret = request.nextUrl.searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Redirect to POST handler logic
  const newRequest = new NextRequest(request.url, {
    method: 'POST',
    headers: new Headers({
      authorization: `Bearer ${process.env.CRON_SECRET}`,
    }),
  });
  return POST(newRequest);
}
