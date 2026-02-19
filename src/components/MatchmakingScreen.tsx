'use client';

import { useEffect, useState, useRef } from 'react';
import { pusherClient } from '@/lib/pusher';

interface MatchmakingScreenProps {
  playerId: string;
  lobbyId: string;
  onGameStart: (gameId: string, opponentName: string, isAiGame: boolean) => void;
}

export default function MatchmakingScreen({ 
  playerId, 
  lobbyId, 
  onGameStart 
}: MatchmakingScreenProps) {
  const [searching, setSearching] = useState(true);
  const [dots, setDots] = useState(1);
  const [waitTime, setWaitTime] = useState(0);
  const queuedRef = useRef(false);

  const channelRef = useRef<any>(null);
  const gameStartedRef = useRef(false);

  useEffect(() => {
    if (gameStartedRef.current) return; // Already handled
    
    // Subscribe to player channel FIRST
    const channel = pusherClient.subscribe(`player-${playerId}`);
    channelRef.current = channel;
    
    const handleGameStart = (data: any) => {
      if (gameStartedRef.current) return;
      
      gameStartedRef.current = true;
      setSearching(false);
      onGameStart(data.gameId, data.opponentName, data.isAiGame);
      
      // Clean up after successful match
      if (channelRef.current) {
        channelRef.current.unbind('game-start', handleGameStart);
        pusherClient.unsubscribe(`player-${playerId}`);
        channelRef.current = null;
      }
    };
    
    channel.bind('game-start', handleGameStart);

    // Set up timeout to clean up if no match after 2 minutes
    const cleanupTimeout = setTimeout(() => {
      if (!gameStartedRef.current) {
        if (channelRef.current) {
          channelRef.current.unbind('game-start', handleGameStart);
          pusherClient.unsubscribe(`player-${playerId}`);
          channelRef.current = null;
        }
      }
    }, 120000); // 2 minutes timeout

    // Wait for subscription to be ready, then enter queue
    const enterQueue = async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        const res = await fetch('/api/game', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'queue',
            playerId,
            lobbyId,
          }),
        });
        
        const data = await res.json();
        
        // Never start game immediately - always wait for Pusher event
      } catch (err) {
        console.error('Queue error:', err);
      }
    };

    enterQueue();

    return () => {
      clearTimeout(cleanupTimeout);
    };
  }, [playerId, lobbyId, onGameStart]);

  // Animate dots and show wait time
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => (prev % 3) + 1);
      setWaitTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-900 text-white">
      <div className="text-center">
        <div className="mb-8">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        </div>
        
        <h2 className="text-2xl font-bold mb-2">
          Finding opponent{'.'.repeat(dots)}
        </h2>
        <p className="text-gray-400 mb-2">
          Waiting for someone to join the lobby
        </p>
        <p className="text-sm text-gray-500">
          Wait time: {waitTime}s (max 5s for AI match)
        </p>
        
        <div className="mt-8 text-sm text-gray-500">
          <p>Tip: You'll be matched with either a human or an AI</p>
        </div>
      </div>
    </div>
  );
}
