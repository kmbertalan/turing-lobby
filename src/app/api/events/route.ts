import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const playerId = searchParams.get('playerId');
  const lastIndex = parseInt(searchParams.get('lastIndex') || '0');

  if (!playerId) {
    return NextResponse.json({ error: 'playerId required' }, { status: 400 });
  }

  const events = await redis.lrange(`player:${playerId}:events`, lastIndex, -1);
  const parsedEvents = events.map(e => typeof e === 'string' ? JSON.parse(e) : e);

  return NextResponse.json({ events: parsedEvents, nextIndex: lastIndex + events.length });
}
