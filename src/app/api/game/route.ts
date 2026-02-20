import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { redis, queueKey, gameKey, playerKey, lobbyPlayersKey, lobbyKey } from '@/lib/redis';
import { Game, Player, AiPersonality, Lobby } from '@/lib/types';
import { pusherServer } from '@/lib/pusher';
import { generateAiResponse, generateGreeting } from '@/lib/ai';

const AI_CHANCE = 0.5;
const GAME_DURATION = 120000; // 2 minutes
const aiPersonalities: AiPersonality[] = ['normal', 'quirky', 'too-perfect', 'suspicious'];

function getRandomPersonality(): AiPersonality {
  return aiPersonalities[Math.floor(Math.random() * aiPersonalities.length)];
}

async function sendAiStarterMessage(gameId: string, playerId: string, game: Game) {
  if (!game.isAiGame || !game.aiPersonality) return;
  if (Math.random() >= 0.5) return; // Only 50% of the time
  
  setTimeout(async () => {
    try {
      // Generate a personalized greeting based on the persona
      if (!game.aiPersonality) return;
      const content = await generateGreeting(game.aiPersonality);
      
      const aiMessage = {
        id: uuidv4(),
        senderId: 'ai',
        senderName: "",
        content,
        timestamp: Date.now(),
      };

      game.messages.push(aiMessage);
      await redis.set(gameKey(gameId), JSON.stringify(game), { ex: 600 });
      
      await pusherServer.trigger(`player-${playerId}`, 'message', aiMessage);
    } catch (err) {
      console.error('AI starter message error:', err);
    }
  }, 1000 + Math.random() * 2000); // 1-2 second delay
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'queue') {
      const { playerId, lobbyId } = body;
      
      // Add player to queue (using Set to prevent duplicates)
      await redis.sadd(queueKey(lobbyId), playerId);
      
      // No automatic matching - players just wait in queue until trigger
      
      return NextResponse.json({ matched: false });
    }

    if (action === 'trigger') {
      const { lobbyId } = body;
      
      // Get all queued players
      const queueMembers = await redis.smembers(queueKey(lobbyId));
      
      if (queueMembers.length < 2) {
        return NextResponse.json({ error: 'Need at least 2 players to trigger match' }, { status: 400 });
      }

      // Clear the queue
      await redis.del(queueKey(lobbyId));
      
      // Mark lobby as closed to prevent new joins
      const lobbyData = await redis.get<string>(lobbyKey(lobbyId));
      if (lobbyData) {
        const lobby: Lobby = typeof lobbyData === 'string' ? JSON.parse(lobbyData) : lobbyData;
        lobby.state = 'closed';
        await redis.set(lobbyKey(lobbyId), JSON.stringify(lobby));
      }
      
      // Create games ensuring every player gets matched
      const games: Game[] = [];
      
      // Shuffle players
      const shuffledPlayers = [...queueMembers].sort(() => Math.random() - 0.5);
      
      // Assign each player randomly to AI or human pool
      const aiPlayers: string[] = [];
      const humanPlayers: string[] = [];
      
      for (const playerId of shuffledPlayers) {
        if (Math.random() < AI_CHANCE) {
          aiPlayers.push(playerId);
        } else {
          humanPlayers.push(playerId);
        }
      }
      
      // If odd number of human players, move the last one to AI
      if (humanPlayers.length % 2 === 1) {
        const lastHuman = humanPlayers.pop()!;
        aiPlayers.push(lastHuman);
      }
      
      // Create AI games for AI players
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
          player2Name: player.name, // AI takes the same name for now
          isAiGame: true,
          aiPersonality: getRandomPersonality(),
          messages: [],
          startedAt: Date.now(),
          status: 'active',
        };

        await redis.set(gameKey(gameId), JSON.stringify(game), { ex: 600 });
        games.push(game);
        
        // Send AI starter message
        sendAiStarterMessage(gameId, playerId, game);
      }
      
      // Create human games by pairing human players
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
      
      // Send Pusher events to all players after a delay
      setTimeout(async () => {
        for (const game of games) {
          await pusherServer.trigger(`player-${game.player1Id}`, 'game-start', {
            gameId: game.id,
            opponentName: game.isAiGame ? "AI" : "Human",
            isAiGame: game.isAiGame,
          });

          if (!game.isAiGame) {
            await pusherServer.trigger(`player-${game.player2Id}`, 'game-start', {
              gameId: game.id,
              opponentName: "Human",
              isAiGame: game.isAiGame,
            });
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

      // Broadcast to opponent
      const opponentId = playerId === game.player1Id ? game.player2Id : game.player1Id;
      
      if (opponentId !== 'ai') {
        await pusherServer.trigger(`player-${opponentId}`, 'message', message);
      } else {
        // Generate AI response
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
            
            await pusherServer.trigger(`player-${game.player1Id}`, 'message', aiMessage);
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

      // Check if both guessed
      const p1Guessed = game.player1Guess !== undefined;
      const p2Guessed = game.isAiGame || game.player2Guess !== undefined;

      if (p1Guessed && p2Guessed) {
        game.status = 'finished';
        game.endedAt = Date.now();
        
        // Update scores
        if (game.player1Correct) {
          const p1Data = await redis.get<string>(playerKey(game.player1Id));
          if (p1Data) {
          const p1: Player = typeof p1Data === 'string' ? JSON.parse(p1Data) : p1Data;
            p1.score += 1;
            p1.gamesPlayed += 1;
            await redis.set(playerKey(game.player1Id), JSON.stringify(p1));
          }
        }

        if (!game.isAiGame && game.player2Correct) {
          const p2Data = await redis.get<string>(gameKey(gameId).replace('game:', 'player:').replace(gameId, game.player2Id));
          if (p2Data) {
            const p2: Player = typeof p2Data === 'string' ? JSON.parse(p2Data) : p2Data;
            p2.score += 1;
            p2.gamesPlayed += 1;
            await redis.set(playerKey(game.player2Id), JSON.stringify(p2));
          }
        }
      } else {
        game.status = 'guessing';
      }

      await redis.set(gameKey(gameId), JSON.stringify(game), { ex: 600 });

      // Notify players
      await pusherServer.trigger(`player-${game.player1Id}`, 'game-update', {
        yourGuess: game.player1Guess,
        opponentGuessed: game.isAiGame ? true : game.player2Guess !== undefined,
        result: game.status === 'finished' ? {
          isAiGame: game.isAiGame,
          youCorrect: game.player1Correct,
          opponentCorrect: game.isAiGame ? undefined : game.player2Correct,
        } : null,
      });

      if (!game.isAiGame) {
        await pusherServer.trigger(`player-${game.player2Id}`, 'game-update', {
          yourGuess: game.player2Guess,
          opponentGuessed: game.player1Guess !== undefined,
          result: game.status === 'finished' ? {
            isAiGame: game.isAiGame,
            youCorrect: game.player2Correct,
            opponentCorrect: game.player1Correct,
          } : null,
        });
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
