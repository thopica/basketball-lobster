import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const sort = searchParams.get('sort') || 'hot';
  const type = searchParams.get('type') || 'all';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 50);
  const topPeriod = searchParams.get('top_period') || 'today';
  const userId = searchParams.get('user_id') || null;

  const offset = (page - 1) * limit;
  const supabase = createAdminClient();

  try {
    let query = supabase
      .from('content')
      .select('*', { count: 'exact' })
      .eq('published', true);

    // Filter by content type
    if (type !== 'all') {
      query = query.eq('content_type', type);
    }

    // Sort
    switch (sort) {
      case 'new':
        query = query.order('created_at', { ascending: false });
        break;
      case 'top': {
        // Filter by time period
        const now = new Date();
        let since: Date;
        switch (topPeriod) {
          case 'week':
            since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          default: // today
            since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        }
        query = query
          .gte('created_at', since.toISOString())
          .order('vote_count', { ascending: false });
        break;
      }
      case 'hot':
      default:
        // For hot, we fetch recent items and sort client-side using the algorithm
        // (Supabase doesn't support computed column sorting)
        query = query
          .gte('created_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false });
        break;
    }

    query = query.range(offset, offset + limit - 1);

    const { data: content, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let items = content || [];

    // Apply hot ranking algorithm if sort=hot
    if (sort === 'hot') {
      items = items
        .map((item) => {
          const hoursAge =
            (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60);
          const hotScore =
            (item.vote_count + (item.ai_quality_score || 5)) /
            Math.pow(hoursAge + 2, 1.5);
          return { ...item, hot_score: hotScore };
        })
        .sort((a: any, b: any) => b.hot_score - a.hot_score);
    }

    // If user is logged in, check which items they've voted on
    if (userId) {
      const contentIds = items.map((i) => i.id);
      const { data: userVotes } = await supabase
        .from('votes')
        .select('content_id')
        .eq('user_id', userId)
        .in('content_id', contentIds);

      const votedIds = new Set((userVotes || []).map((v) => v.content_id));
      items = items.map((item) => ({
        ...item,
        user_voted: votedIds.has(item.id),
      }));
    }

    return NextResponse.json({
      items,
      total: count,
      page,
      limit,
      has_more: (count || 0) > offset + limit,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
