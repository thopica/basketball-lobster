import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();

  try {
    const { content_id, user_id } = await request.json();

    if (!content_id || !user_id) {
      return NextResponse.json({ error: 'Missing content_id or user_id' }, { status: 400 });
    }

    // Check if already voted
    const { data: existingVote } = await supabase
      .from('votes')
      .select('id')
      .eq('user_id', user_id)
      .eq('content_id', content_id)
      .single();

    if (existingVote) {
      // Remove vote (toggle off)
      await supabase.from('votes').delete().eq('id', existingVote.id);
      return NextResponse.json({ voted: false });
    }

    // Add vote
    const { error } = await supabase.from('votes').insert({
      user_id,
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
