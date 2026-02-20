import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createRouteClient } from '@/lib/supabase-server';
import { curateContent } from '@/lib/ai-curator';

export async function POST(request: NextRequest) {
  const authClient = createRouteClient();
  const { data: { user } } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    const { url, content_type } = await request.json();

    if (!url || !content_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from('content')
      .select('id')
      .eq('url', url)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'This URL has already been submitted' }, { status: 409 });
    }

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
      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
      if (descMatch) contentText = descMatch[1];
    } catch {
      // If fetch fails, use URL as headline
    }

    const aiResult = await curateContent(headline, 'User Submission', contentText || headline);

    const published = aiResult.score >= 4;
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
        submitted_by: user.id,
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
