import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();

  try {
    const { content_id, user_id, body, parent_id } = await request.json();

    if (!content_id || !user_id || !body?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: comment, error } = await supabase
      .from('comments')
      .insert({
        content_id,
        user_id,
        body: body.trim(),
        parent_id: parent_id || null,
      })
      .select(`*, profile:profiles(id, username, avatar_url, karma)`)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(comment);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
