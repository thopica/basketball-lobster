import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const [review, unpublished, published, all] = await Promise.all([
    supabase.from('content').select('*', { count: 'exact', head: true }).eq('published', true).eq('needs_review', true),
    supabase.from('content').select('*', { count: 'exact', head: true }).eq('published', false),
    supabase.from('content').select('*', { count: 'exact', head: true }).eq('published', true).eq('needs_review', false),
    supabase.from('content').select('*', { count: 'exact', head: true }),
  ]);

  return NextResponse.json({
    review: review.count || 0,
    unpublished: unpublished.count || 0,
    published: published.count || 0,
    all: all.count || 0,
  });
}
