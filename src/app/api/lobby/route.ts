import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { redis, lobbyKey, lobbyCodeKey, lobbyPlayersKey, playerKey } from '@/lib/redis';
import { Lobby, Player } from '@/lib/types';

function generateLobbyCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'create') {
      const lobbyId = uuidv4();
      const code = generateLobbyCode();
      
      const lobby: Lobby = {
        id: lobbyId,
        code,
        createdAt: Date.now(),
        maxPlayers: 100,
      };

      await redis.set(lobbyKey(lobbyId), JSON.stringify(lobby));
      await redis.set(lobbyCodeKey(code), lobbyId);

      return NextResponse.json({ lobbyId, code });
    }

    if (action === 'join') {
      const { code, playerName } = body;
      
      const lobbyId = await redis.get<string>(lobbyCodeKey(code.toUpperCase()));
      if (!lobbyId) {
        return NextResponse.json({ error: 'Invalid lobby code' }, { status: 404 });
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
