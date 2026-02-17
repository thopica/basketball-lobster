import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';
import { curateContent } from '@/lib/ai-curator';

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();

  try {
    const { url, content_type, user_id } = await request.json();

    if (!url || !content_type || !user_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check for duplicate URL
    const { data: existing } = await supabase
      .from('content')
      .select('id')
      .eq('url', url)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'This URL has already been submitted' }, { status: 409 });
    }

    // Try to fetch page title from URL
    let headline = url;
    let contentText = '';
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'BasketballLobster/1.0' },
        signal: AbortSignal.timeout(5000),
      });
      const html = await res.text();
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) headline = titleMatch[1].trim();
      // Extract meta description
      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
      if (descMatch) contentText = descMatch[1];
    } catch {
      // If fetch fails, use URL as headline
    }

    // AI Curation
    const aiResult = await curateContent(headline, 'User Submission', contentText || headline);

    const published = aiResult.score >= 4; // Lower threshold for user submissions
    const needsReview = aiResult.score < 6;

    const { data: content, error } = await supabase
      .from('content')
      .insert({
        url,
        headline,
        summary: aiResult.summary,
        source_name: new URL(url).hostname.replace('www.', ''),
        content_type,
        ai_quality_score: aiResult.score,
        ai_score_reason: aiResult.reason,
        is_user_submitted: true,
        submitted_by: user_id,
        published,
        needs_review: needsReview,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      content,
      published,
      message: published
        ? 'Your submission is live!'
        : 'Your submission is pending review.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
