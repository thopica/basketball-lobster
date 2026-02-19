import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status') || 'review';
  const type = searchParams.get('type') || 'all';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  const supabase = createAdminClient();

  let query = supabase
    .from('content')
    .select('*', { count: 'exact' });

  switch (status) {
    case 'review':
      query = query.eq('published', true).eq('needs_review', true);
      break;
    case 'unpublished':
      query = query.eq('published', false);
      break;
    case 'published':
      query = query.eq('published', true).eq('needs_review', false);
      break;
  }

  if (type !== 'all') {
    query = query.eq('content_type', type);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    items: data,
    total: count,
    page,
    limit,
    has_more: (count || 0) > offset + limit,
  });
}

export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { id, ids, action } = body;

  if (!action || (!id && !ids)) {
    return NextResponse.json({ error: 'Missing id/ids and action' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const targetIds: string[] = ids || [id];

  if (action !== 'approve') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const update = { published: true, needs_review: false };

  const { error } = await supabase
    .from('content')
    .update(update)
    .in('id', targetIds);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, updated: targetIds.length });
}

export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { id, ids } = body;
  const targetIds: string[] = ids || [id];

  const supabase = createAdminClient();

  const { error } = await supabase
    .from('content')
    .delete()
    .in('id', targetIds);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted: targetIds.length });
}
