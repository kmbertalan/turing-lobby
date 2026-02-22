import { redis } from './redis';
import { v4 as uuidv4 } from 'uuid';

export async function pushEvent(playerId: string, event: { type: string; payload: any }) {
  const eventData = {
    id: uuidv4(),
    type: event.type,
    payload: event.payload,
    createdAt: Date.now(),
  };

  await redis.rpush(`player:${playerId}:events`, JSON.stringify(eventData));
  await redis.expire(`player:${playerId}:events`, 600);
}
