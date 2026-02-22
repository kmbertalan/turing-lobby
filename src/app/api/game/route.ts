import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { redis, queueKey, gameKey, playerKey, lobbyKey } from '@/lib/redis';
import { Game, Player, AiPersonality, Lobby } from '@/lib/types';
import { generateAiResponse, generateGreeting } from '@/lib/ai';
import { pushEvent } from '@/lib/events';

const AI_CHANCE = 0.5;
const aiPersonalities: AiPersonality[] = ['normal', 'quirky', 'too-perfect', 'suspicious'];

function getRandomPersonality(): AiPersonality {
  return aiPersonalities[Math.floor(Math.random() * aiPersonalities.length)];
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendAiStarterMessage(gameId: string, playerId: string, game: Game) {
  if (!game.isAiGame || !game.aiPersonality) return;
  if (Math.random() >= 0.5) return;
  
  await sleep(1000 + Math.random() * 2000);

  const latestGameData = await redis.get<string>(gameKey(gameId));
  if (!latestGameData) return;
  const latestGame: Game = typeof latestGameData === 'string' ? JSON.parse(latestGameData) : latestGameData;
  if (latestGame.messages.length > 0) return;
  
  try {
    const content = await generateGreeting(latestGame.aiPersonality!);
    
    const aiMessage = {
      id: uuidv4(),
      senderId: 'ai',
      senderName: "",
      content,
      timestamp: Date.now(),
    };

    latestGame.messages.push(aiMessage);
    await redis.set(gameKey(gameId), JSON.stringify(latestGame), { ex: 600 });
    
    await pushEvent(playerId, { type: 'message', payload: aiMessage });
  } catch (err) {
    console.error('AI starter message error:', err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'queue') {
      const { playerId, lobbyId } = body;
      
      await redis.sadd(queueKey(lobbyId), playerId);
      
      return NextResponse.json({ matched: false });
    }

    if (action === 'trigger') {
      const { lobbyId } = body;
      
      const queueMembers = await redis.smembers(queueKey(lobbyId));
      
      if (queueMembers.length < 2) {
        return NextResponse.json({ error: 'Need at least 2 players to trigger match' }, { status: 400 });
      }

      await redis.del(queueKey(lobbyId));
      
      const lobbyData = await redis.get<string>(lobbyKey(lobbyId));
      if (lobbyData) {
        const lobby: Lobby = typeof lobbyData === 'string' ? JSON.parse(lobbyData) : lobbyData;
        lobby.state = 'closed';
        await redis.set(lobbyKey(lobbyId), JSON.stringify(lobby));
      }
      
      const games: Game[] = [];
      
      const shuffledPlayers = [...queueMembers].sort(() => Math.random() - 0.5);
      
      const aiPlayers: string[] = [];
      const humanPlayers: string[] = [];
      
      for (const playerId of shuffledPlayers) {
        if (Math.random() < AI_CHANCE) {
          aiPlayers.push(playerId);
        } else {
          humanPlayers.push(playerId);
        }
      }
      
      if (humanPlayers.length % 2 === 1) {
        const lastHuman = humanPlayers.pop()!;
        aiPlayers.push(lastHuman);
      }
      
      for (const playerId of aiPlayers) {
        const playerData = await redis.get<string>(playerKey(playerId));
        if (!playerData) continue;
        
        const player: Player = typeof playerData === 'string' ? JSON.parse(playerData) : playerData;
        const gameId = uuidv4();
        
        const game: Game = {
          id: gameId,
          lobbyId,
          player1Id: playerId,
          player2Id: 'ai',
          player1Name: player.name,
          player2Name: player.name,
          isAiGame: true,
          aiPersonality: getRandomPersonality(),
          messages: [],
          startedAt: Date.now(),
          status: 'active',
        };

        await redis.set(gameKey(gameId), JSON.stringify(game), { ex: 600 });
        games.push(game);
        
        sendAiStarterMessage(gameId, playerId, game);
      }
      
      for (let i = 0; i < humanPlayers.length; i += 2) {
        const p1Id = humanPlayers[i];
        const p2Id = humanPlayers[i + 1];
        
        const [p1Data, p2Data] = await Promise.all([
          redis.get<string>(playerKey(p1Id)),
          redis.get<string>(playerKey(p2Id)),
        ]);
        
        if (!p1Data || !p2Data) continue;
        
        const p1: Player = typeof p1Data === 'string' ? JSON.parse(p1Data) : p1Data;
        const p2: Player = typeof p2Data === 'string' ? JSON.parse(p2Data) : p2Data;
        const gameId = uuidv4();
        
        const game: Game = {
          id: gameId,
          lobbyId,
          player1Id: p1Id,
          player2Id: p2Id,
          player1Name: p1.name,
          player2Name: p2.name,
          isAiGame: false,
          messages: [],
          startedAt: Date.now(),
          status: 'active',
        };

        await redis.set(gameKey(gameId), JSON.stringify(game), { ex: 600 });
        games.push(game);
      }
      
      setTimeout(async () => {
        for (const game of games) {
          await pushEvent(game.player1Id, { type: 'game-start', payload: { gameId: game.id, opponentName: game.isAiGame ? "AI" : "Human", isAiGame: game.isAiGame } });

          if (!game.isAiGame) {
            await pushEvent(game.player2Id, { type: 'game-start', payload: { gameId: game.id, opponentName: "Human", isAiGame: game.isAiGame } });
          }
        }
      }, 1000);
      
      return NextResponse.json({ 
        triggered: true, 
        gamesCreated: games.length,
        playersMatched: games.length * 2
      });
    }

    if (action === 'message') {
      const { gameId, playerId, content } = body;
      
      const gameData = await redis.get<string>(gameKey(gameId));
      if (!gameData) {
        return NextResponse.json({ error: 'Game not found' }, { status: 404 });
      }

      const game: Game = typeof gameData === 'string' ? JSON.parse(gameData) : gameData;
      
      const message = {
        id: uuidv4(),
        senderId: playerId,
        senderName: "",
        content,
        timestamp: Date.now(),
      };

      game.messages.push(message);
      await redis.set(gameKey(gameId), JSON.stringify(game), { ex: 600 });

      const opponentId = playerId === game.player1Id ? game.player2Id : game.player1Id;
      
      if (opponentId !== 'ai') {
        await pushEvent(opponentId, { type: 'message', payload: message });
      } else {
        setTimeout(async () => {
          try {
            const aiResponse = await generateAiResponse(game.aiPersonality!, game.messages);
            
            const aiMessage = {
              id: uuidv4(),
              senderId: 'ai',
              senderName: "",
              content: aiResponse,
              timestamp: Date.now(),
            };

            game.messages.push(aiMessage);

            await redis.set(gameKey(gameId), JSON.stringify(game), { ex: 600 });
            
            await pushEvent(game.player1Id, { type: 'message', payload: aiMessage });
          } catch (err) {
            console.error('AI response error:', err);
          }
        }, 1000 + Math.random() * 2000);
      }

      await redis.set(gameKey(gameId), JSON.stringify(game), { ex: 600 });
      
      return NextResponse.json({ success: true });
    }

    if (action === 'guess') {
      const { gameId, playerId, guess } = body;
      
      const gameData = await redis.get<string>(gameKey(gameId));
      if (!gameData) {
        return NextResponse.json({ error: 'Game not found' }, { status: 404 });
      }

      const game: Game = typeof gameData === 'string' ? JSON.parse(gameData) : gameData;
      const isPlayer1 = playerId === game.player1Id;
      
      const correctGuess = game.isAiGame ? 'ai' : 'human';
      
      if (isPlayer1) {
        game.player1Guess = guess;
        game.player1Correct = guess === correctGuess;
      } else {
        game.player2Guess = guess;
        game.player2Correct = guess === correctGuess;
      }

      const p1Guessed = game.player1Guess !== undefined;
      const p2Guessed = game.isAiGame || game.player2Guess !== undefined;

      game.status = (p1Guessed && p2Guessed) ? 'finished' : 'guessing';
      if (game.status === 'finished') {
        game.endedAt = Date.now();
      }

      await redis.set(gameKey(gameId), JSON.stringify(game), { ex: 600 });

      await pushEvent(game.player1Id, { type: 'game-update', payload: {
        yourGuess: game.player1Guess,
        opponentGuessed: game.isAiGame ? true : game.player2Guess !== undefined,
        result: p1Guessed ? {
          isAiGame: game.isAiGame,
          youCorrect: game.player1Correct,
          opponentCorrect: game.isAiGame ? undefined : (p2Guessed ? game.player2Correct : undefined),
        } : null,
      } });

      if (!game.isAiGame) {
        await pushEvent(game.player2Id, { type: 'game-update', payload: {
          yourGuess: game.player2Guess,
          opponentGuessed: game.player1Guess !== undefined,
          result: p2Guessed ? {
            isAiGame: game.isAiGame,
            youCorrect: game.player2Correct,
            opponentCorrect: game.player1Correct,
          } : null,
        } });
      }

      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error('Game API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get('gameId');
  
  if (!gameId) {
    return NextResponse.json({ error: 'Game ID required' }, { status: 400 });
  }

  const gameData = await redis.get<string>(gameKey(gameId));
  if (!gameData) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  return NextResponse.json(typeof gameData === 'string' ? JSON.parse(gameData) : gameData);
}
