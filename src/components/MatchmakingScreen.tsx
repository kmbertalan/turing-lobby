'use client';

import { useEffect, useState, useRef } from 'react';
import { pusherClient } from '@/lib/pusher';

interface MatchmakingScreenProps {
  playerId: string;
  lobbyId: string;
  lobbyCode: string;
  onGameStart: (gameId: string, opponentName: string, isAiGame: boolean) => void;
}

export default function MatchmakingScreen({ 
  playerId, 
  lobbyId, 
  lobbyCode,
  onGameStart 
}: MatchmakingScreenProps) {
  const [searching, setSearching] = useState(true);
  const [dots, setDots] = useState(1);
  const [waitTime, setWaitTime] = useState(0);
  const queuedRef = useRef(false);

  const [queueSize, setQueueSize] = useState(0);
  const [isHost, setIsHost] = useState(false);
  const [triggering, setTriggering] = useState(false);

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

    // Check if this user is the lobby host (first player to join)
    const checkHostStatus = async () => {
      try {
        const res = await fetch(`/api/lobby?checkHost=true&lobbyId=${lobbyId}&playerId=${playerId}`);
        if (res.ok) {
          const data = await res.json();
          setIsHost(data.isHost);
        }
      } catch (err) {
        console.error('Failed to check host status:', err);
      }
    };

    // Fetch current queue size
    const fetchQueueSize = async () => {
      try {
        const res = await fetch(`/api/lobby?queueSize=true&lobbyId=${lobbyId}`);
        if (res.ok) {
          const data = await res.json();
          setQueueSize(data.queueSize);
        }
      } catch (err) {
        console.error('Failed to fetch queue size:', err);
      }
    };

    checkHostStatus();
    fetchQueueSize();

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

    // Periodically update queue size
    const queueUpdateInterval = setInterval(fetchQueueSize, 2000);

    return () => {
      clearTimeout(cleanupTimeout);
      clearInterval(queueUpdateInterval);
    };
  }, [playerId, lobbyId, onGameStart]);

  const triggerMatch = async () => {
    if (triggering) return;
    
    setTriggering(true);
    try {
      const res = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'trigger',
          lobbyId,
        }),
      });
      
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        // Trigger successful, wait for Pusher events to start games
        setSearching(false);
      }
    } catch (err) {
      console.error('Trigger error:', err);
      alert('Failed to trigger matches');
    } finally {
      setTriggering(false);
    }
  };

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
          Waiting in Lobby{'.'.repeat(dots)}
        </h2>
        
        <div className="bg-gray-800 p-4 rounded-lg mb-4">
          <p className="text-gray-400 text-sm mb-1">Lobby Code:</p>
          <p className="text-2xl font-mono font-bold tracking-wider">{lobbyCode}</p>
        </div>
        
        <p className="text-gray-400 mb-4">
          Players in queue: <span className="text-white font-bold">{queueSize}</span>
        </p>
        
        {isHost && (
          <div className="mb-6">
            <p className="text-sm text-yellow-400 mb-3">You are the lobby host</p>
            <button
              onClick={triggerMatch}
              disabled={triggering || queueSize < 2}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3 px-8 rounded-lg text-lg disabled:cursor-not-allowed"
            >
              {triggering ? 'Starting Games...' : `Start Games (${queueSize} players)`}
            </button>
            {queueSize < 2 && (
              <p className="text-sm text-gray-500 mt-2">Need at least 2 players to start</p>
            )}
          </div>
        )}
        
        {!isHost && (
          <p className="text-sm text-gray-500 mb-4">Waiting for host to start the games...</p>
        )}
        
        <div className="mt-8 text-sm text-gray-500">
          <p>Tip: The lobby host will start the games when ready</p>
          <p>Games are 2 minutes long with AI/human guessing</p>
        </div>
      </div>
    </div>
  );
}
