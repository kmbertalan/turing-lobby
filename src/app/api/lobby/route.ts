import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { redis, lobbyKey, lobbyCodeKey, lobbyPlayersKey, playerKey, queueKey } from '@/lib/redis';
import { Lobby, Player } from '@/lib/types';

function generateLobbyCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'create') {
      const { playerName } = body;
      
      const lobbyId = uuidv4();
      const code = generateLobbyCode();
      
      // Create the creator player first
      const creatorId = uuidv4();
      const creator: Player = {
        id: creatorId,
        name: playerName || `Player ${Math.floor(Math.random() * 1000)}`,
        lobbyId,
        score: 0,
        gamesPlayed: 0,
      };

      const lobby: Lobby = {
        id: lobbyId,
        code,
        createdAt: Date.now(),
        maxPlayers: 100,
        state: 'open',
        creatorId,
      };

      await redis.set(lobbyKey(lobbyId), JSON.stringify(lobby));
      await redis.set(lobbyCodeKey(code), lobbyId);
      await redis.set(playerKey(creatorId), JSON.stringify(creator));
      await redis.sadd(lobbyPlayersKey(lobbyId), creatorId);

      return NextResponse.json({ lobbyId, code, playerId: creatorId });
    }

    if (action === 'join') {
      const { code, playerName } = body;
      
      const lobbyId = await redis.get<string>(lobbyCodeKey(code.toUpperCase()));
      if (!lobbyId) {
        return NextResponse.json({ error: 'Invalid lobby code' }, { status: 404 });
      }

      // Check if lobby is still open
      const lobbyData = await redis.get<string>(lobbyKey(lobbyId));
      if (lobbyData) {
        const lobby: Lobby = typeof lobbyData === 'string' ? JSON.parse(lobbyData) : lobbyData;
        if (lobby.state === 'closed') {
          return NextResponse.json({ error: 'Lobby is closed for new players' }, { status: 403 });
        }
      }

      const playerId = uuidv4();
      const player: Player = {
        id: playerId,
        name: playerName || `Player ${Math.floor(Math.random() * 1000)}`,
        lobbyId,
        score: 0,
        gamesPlayed: 0,
      };

      await redis.set(playerKey(playerId), JSON.stringify(player));
      await redis.sadd(lobbyPlayersKey(lobbyId), playerId);

      return NextResponse.json({ playerId, lobbyId, code: code.toUpperCase() });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Lobby API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const checkHost = searchParams.get('checkHost');
  const queueSize = searchParams.get('queueSize');
  const lobbyId = searchParams.get('lobbyId');
  const playerId = searchParams.get('playerId');

  if (checkHost === 'true' && lobbyId && playerId) {
    try {
      // Check if this player is the lobby creator
      const lobbyData = await redis.get<string>(lobbyKey(lobbyId));
      if (lobbyData) {
        const lobby: Lobby = typeof lobbyData === 'string' ? JSON.parse(lobbyData) : lobbyData;
        const isHost = lobby.creatorId === playerId;
        return NextResponse.json({ isHost });
      }
      return NextResponse.json({ isHost: false });
    } catch (error) {
      console.error('Check host error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  if (queueSize === 'true' && lobbyId) {
    try {
      const size = await redis.scard(queueKey(lobbyId));
      return NextResponse.json({ queueSize: size });
    } catch (error) {
      console.error('Queue size error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}
