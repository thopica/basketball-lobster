import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createRouteClient } from '@/lib/supabase-server';
import { calculateHotScore } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function diversifyFeed(items: any[]): any[] {
  if (items.length <= 2) return items;

  const result: any[] = [];
  const remaining = [...items];

  while (remaining.length > 0) {
    const prev1 = result[result.length - 1];
    const prev2 = result[result.length - 2];

    const idx = remaining.findIndex((item) => {
      const sameSource =
        prev1?.source_name === item.source_name &&
        prev2?.source_name === item.source_name;
      const sameType =
        prev1?.content_type === item.content_type &&
        prev2?.content_type === item.content_type;
      return !sameSource && !sameType;
    });

    if (idx >= 0) {
      result.push(remaining.splice(idx, 1)[0]);
    } else {
      result.push(remaining.shift()!);
    }
  }

  return result;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const sort = searchParams.get('sort') || 'hot';
  const type = searchParams.get('type') || 'all';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 50);
  const topPeriod = searchParams.get('top_period') || 'today';

  // Derive user from session cookie (no client-provided user_id)
  let userId: string | null = null;
  try {
    const authClient = createRouteClient();
    const { data: { user } } = await authClient.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    // Not logged in — that's fine for a read-only route
  }

  const offset = (page - 1) * limit;
  const supabase = createAdminClient();

  try {
    let query = supabase
      .from('content')
      .select('*', { count: 'exact' })
      .eq('published', true);

    if (type !== 'all') {
      query = query.eq('content_type', type);
    }

    switch (sort) {
      case 'new':
        query = query.order('created_at', { ascending: false });
        break;
      case 'top': {
        const now = new Date();
        let since: Date;
        switch (topPeriod) {
          case 'week':
            since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        }
        query = query
          .gte('created_at', since.toISOString())
          .order('vote_count', { ascending: false });
        break;
      }
      case 'hot':
      default:
        query = query
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false });
        break;
    }

    query = query.range(offset, offset + limit - 1);

    const { data: content, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let items = content || [];

    if (sort === 'hot') {
      items = items
        .map((item) => {
          const hotScore = calculateHotScore(
            item.vote_count,
            item.ai_quality_score || 5,
            item.created_at,
            item.content_type
          );
          return { ...item, hot_score: hotScore };
        })
        .sort((a: any, b: any) => b.hot_score - a.hot_score);
    }

    items = diversifyFeed(items);

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
