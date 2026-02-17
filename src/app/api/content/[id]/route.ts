import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient();
  const userId = request.nextUrl.searchParams.get('user_id') || null;

  try {
    // Fetch content item
    const { data: content, error: contentError } = await supabase
      .from('content')
      .select('*')
      .eq('id', params.id)
      .eq('published', true)
      .single();

    if (contentError || !content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    // Fetch comments with user profiles
    const { data: comments, error: commentsError } = await supabase
      .from('comments')
      .select(`
        *,
        profile:profiles(id, username, avatar_url, karma)
      `)
      .eq('content_id', params.id)
      .order('created_at', { ascending: true });

    if (commentsError) {
      console.error('Comments fetch error:', commentsError);
    }

    // Check if user voted on this content
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

    // Check which comments user voted on
    let commentVoteIds = new Set<string>();
    if (userId && comments?.length) {
      const { data: commentVotes } = await supabase
        .from('comment_votes')
        .select('comment_id')
        .eq('user_id', userId)
        .in('comment_id', comments.map((c) => c.id));
      commentVoteIds = new Set((commentVotes || []).map((v) => v.comment_id));
    }

    // Build threaded comment tree
    const commentMap = new Map();
    const rootComments: any[] = [];

    (comments || []).forEach((comment) => {
      const enriched = {
        ...comment,
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
