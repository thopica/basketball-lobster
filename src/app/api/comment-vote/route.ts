import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createRouteClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  const authClient = createRouteClient();
  const { data: { user } } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    const { comment_id } = await request.json();

    if (!comment_id) {
      return NextResponse.json({ error: 'Missing comment_id' }, { status: 400 });
    }

    const { data: existingVote } = await supabase
      .from('comment_votes')
      .select('id')
      .eq('user_id', user.id)
      .eq('comment_id', comment_id)
      .single();

    if (existingVote) {
      await supabase.from('comment_votes').delete().eq('id', existingVote.id);
      return NextResponse.json({ voted: false });
    }

    const { error } = await supabase.from('comment_votes').insert({
      user_id: user.id,
      comment_id,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ voted: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
