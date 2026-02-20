import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createRouteClient } from '@/lib/supabase-server';

export async function GET() {
  const authClient = createRouteClient();
  const { data: { user } } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile, email: user.email });
}

export async function PATCH(request: NextRequest) {
  const authClient = createRouteClient();
  const { data: { user } } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    const { username, avatar_url } = await request.json();

    const updates: Record<string, any> = {};
    if (username !== undefined) {
      const trimmed = username.trim();
      if (trimmed.length < 2) {
        return NextResponse.json({ error: 'Username must be at least 2 characters' }, { status: 400 });
      }
      if (trimmed.length > 30) {
        return NextResponse.json({ error: 'Username must be 30 characters or less' }, { status: 400 });
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
        return NextResponse.json({ error: 'Username can only contain letters, numbers, hyphens, and underscores' }, { status: 400 });
      }

      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', trimmed)
        .neq('id', user.id)
        .single();

      if (existing) {
        return NextResponse.json({ error: 'Username is already taken' }, { status: 409 });
      }

      updates.username = trimmed;
    }
    if (avatar_url !== undefined) {
      updates.avatar_url = avatar_url;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profile });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
