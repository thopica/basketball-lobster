import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createRouteClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Derive user from session cookie
  let userId: string | null = null;
  try {
    const authClient = createRouteClient();
    const { data: { user } } = await authClient.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    // Not logged in
  }

  const supabase = createAdminClient();

  try {
    const { data: content, error: contentError } = await supabase
      .from('content')
      .select('*')
      .eq('id', params.id)
      .eq('published', true)
      .single();

    if (contentError || !content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    const { data: rawComments } = await supabase
      .from('comments')
      .select('*')
      .eq('content_id', params.id)
      .order('created_at', { ascending: true });

    const comments = rawComments || [];

    // Fetch profiles separately (no direct FK from comments to profiles)
    let profileMap = new Map<string, any>();
    if (comments.length > 0) {
      const userIds = Array.from(new Set(comments.map((c) => c.user_id)));
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, karma')
        .in('id', userIds);
      (profiles || []).forEach((p) => profileMap.set(p.id, p));
    }

    let userVoted = false;
    if (userId) {
      const { data: vote } = await supabase
        .from('votes')
        .select('id')
        .eq('user_id', userId)
        .eq('content_id', params.id)
        .single();
      userVoted = !!vote;
    }

    let commentVoteIds = new Set<string>();
    if (userId && comments.length) {
      const { data: commentVotes } = await supabase
        .from('comment_votes')
        .select('comment_id')
        .eq('user_id', userId)
        .in('comment_id', comments.map((c) => c.id));
      commentVoteIds = new Set((commentVotes || []).map((v) => v.comment_id));
    }

    const commentMap = new Map();
    const rootComments: any[] = [];

    comments.forEach((comment) => {
      const enriched = {
        ...comment,
        profile: profileMap.get(comment.user_id) || null,
        user_voted: commentVoteIds.has(comment.id),
        replies: [],
      };
      commentMap.set(comment.id, enriched);
    });

    commentMap.forEach((comment) => {
      if (comment.parent_id && commentMap.has(comment.parent_id)) {
        commentMap.get(comment.parent_id).replies.push(comment);
      } else {
        rootComments.push(comment);
      }
    });

    return NextResponse.json({
      content: { ...content, user_voted: userVoted },
      comments: rootComments,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
