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
    const { content_id } = await request.json();

    if (!content_id) {
      return NextResponse.json({ error: 'Missing content_id' }, { status: 400 });
    }

    const { data: existingVote } = await supabase
      .from('votes')
      .select('id')
      .eq('user_id', user.id)
      .eq('content_id', content_id)
      .single();

    if (existingVote) {
      await supabase.from('votes').delete().eq('id', existingVote.id);
      return NextResponse.json({ voted: false });
    }

    const { error } = await supabase.from('votes').insert({
      user_id: user.id,
      content_id,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ voted: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
