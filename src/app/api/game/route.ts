import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { redis, queueKey, gameKey, playerKey, lobbyPlayersKey } from '@/lib/redis';
import { Game, Player, AiPersonality } from '@/lib/types';
import { pusherServer } from '@/lib/pusher';
import { generateAiResponse, generateGreeting } from '@/lib/ai';

const AI_CHANCE = 0.5;
const GAME_DURATION = 120000; // 2 minutes
const aiPersonalities: AiPersonality[] = ['normal', 'quirky', 'too-perfect', 'suspicious'];

function getRandomPersonality(): AiPersonality {
  return aiPersonalities[Math.floor(Math.random() * aiPersonalities.length)];
}

const AI_FALLBACK_DELAY = 30000; // 30 seconds wait for human (extended for testing)

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
        senderName: game.player2Name,
        content,
        timestamp: Date.now(),
      };

      game.messages.push(aiMessage);
      await redis.set(gameKey(gameId), JSON.stringify(game), { ex: 600 });
      
      await pusherServer.trigger(`player-${playerId}`, 'message', aiMessage);
    } catch (err) {
      console.error('AI starter message error:', err);
    }
  }, 1000 + Math.random() * 1000); // 1-2 second delay
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'queue') {
      const { playerId, lobbyId } = body;
      
      // Add player to queue (using Set to prevent duplicates)
      await redis.sadd(queueKey(lobbyId), playerId);
      
      // Try immediate match with another human
      const queueMembers = await redis.smembers(queueKey(lobbyId));
      
      if (queueMembers.length >= 2) {
        // Get 2 random players from queue
        const [p1Id, p2Id] = queueMembers.slice(0, 2);
        
        // Remove them from queue
        await redis.srem(queueKey(lobbyId), p1Id, p2Id);
        
        if (p1Id === p2Id) {
          await redis.sadd(queueKey(lobbyId), p1Id);
          return NextResponse.json({ matched: false });
        }
        
        const [p1Data, p2Data] = await Promise.all([
          redis.get<string>(playerKey(p1Id)),
          redis.get<string>(playerKey(p2Id)),
        ]);
        
        if (p1Data && p2Data) {
          const p1: Player = typeof p1Data === 'string' ? JSON.parse(p1Data) : p1Data;
          const p2: Player = typeof p2Data === 'string' ? JSON.parse(p2Data) : p2Data;
          
          const isAiGame = Math.random() < AI_CHANCE;
          const gameId = uuidv4();
          
          const game: Game = {
            id: gameId,
            lobbyId,
            player1Id: p1Id,
            player2Id: isAiGame ? 'ai' : p2Id,
            player1Name: p1.name,
            player2Name: isAiGame ? p2.name : p2.name,
            isAiGame,
            aiPersonality: isAiGame ? getRandomPersonality() : undefined,
            messages: [],
            startedAt: Date.now(),
            status: 'active',
          };

          await redis.set(gameKey(gameId), JSON.stringify(game), { ex: 600 });

          // Add delay to ensure both players' Pusher subscriptions are ready
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          await pusherServer.trigger(`player-${p1Id}`, 'game-start', {
            gameId,
            opponentName: game.player2Name,
            isAiGame,
          });

          await pusherServer.trigger(`player-${p2Id}`, 'game-start', {
            gameId,
            opponentName: p1.name,
            isAiGame,
          });

          return NextResponse.json({ matched: true, gameId, isAiGame });
        }
      }

      // No immediate match - set up AI fallback timer (DISABLED for testing)
      // setTimeout(async () => {
      //   try {
      //     // Check if player is still in queue (not yet matched)
      //     const queue = await redis.smembers(queueKey(lobbyId));
      //     const playerIndex = queue.indexOf(playerId);
      //     
      //     if (playerIndex !== -1) {
      //       // Remove player from queue
      //       await redis.srem(queueKey(lobbyId), playerId);
      //       
      //       const playerData = await redis.get<string>(playerKey(playerId));
      //       if (!playerData) return;
      //       
      //       const player: Player = typeof playerData === 'string' ? JSON.parse(playerData) : playerData;
      //       
      //       // Create AI game
      //       const gameId = uuidv4();
      //       const game: Game = {
      //         id: gameId,
      //         lobbyId,
      //         player1Id: playerId,
      //         player2Id: 'ai',
      //         player1Name: player.name,
      //         player2Name: 'Player ' + Math.floor(Math.random() * 1000),
      //         isAiGame: true,
      //         aiPersonality: getRandomPersonality(),
      //         messages: [],
      //         startedAt: Date.now(),
      //         status: 'active',
      //       };

      //       await redis.set(gameKey(gameId), JSON.stringify(game), { ex: 600 });
      //       
      //       // Trigger AI starter message
      //       await sendAiStarterMessage(gameId, playerId, game);
      //       
      //       await pusherServer.trigger(`player-${playerId}`, 'game-start', {
      //         gameId,
      //         opponentName: game.player2Name,
      //         isAiGame: true,
      //       });
      //     }
      //   } catch (err) {
      //     console.error('AI fallback error:', err);
      //   }
      // }, AI_FALLBACK_DELAY);

      return NextResponse.json({ matched: false });
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
        senderName: playerId === game.player1Id ? game.player1Name : game.player2Name,
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
            const aiResponse = await generateAiResponse(game, game.aiPersonality!, game.messages);
            
            const aiMessage = {
              id: uuidv4(),
              senderId: 'ai',
              senderName: game.player2Name,
              content: aiResponse,
              timestamp: Date.now(),
            };

            game.messages.push(aiMessage);
            await redis.set(gameKey(gameId), JSON.stringify(game), { ex: 600 });
            
            await pusherServer.trigger(`player-${game.player1Id}`, 'message', aiMessage);
          } catch (err) {
            console.error('AI response error:', err);
          }
        }, 1000 + Math.random() * 2000); // Random delay 1-3 seconds
      }

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
      
      if (isPlayer1) {
        game.player1Guess = guess;
        game.player1Correct = (guess === 'ai') === game.isAiGame;
      } else {
        game.player2Guess = guess;
        game.player2Correct = (guess === 'human') === !game.isAiGame;
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

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
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
