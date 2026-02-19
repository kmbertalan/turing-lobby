import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// Keys
export const lobbyKey = (lobbyId: string) => `lobby:${lobbyId}`;
export const lobbyCodeKey = (code: string) => `lobby:code:${code}`;
export const queueKey = (lobbyId: string) => `queue:${lobbyId}`;
export const gameKey = (gameId: string) => `game:${gameId}`;
export const playerKey = (playerId: string) => `player:${playerId}`;
export const lobbyPlayersKey = (lobbyId: string) => `lobby:${lobbyId}:players`;
