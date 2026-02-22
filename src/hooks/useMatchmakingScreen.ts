'use client';

import { useGameScreen } from './useGameScreen';

interface UseMatchmakingProps {
  playerId: string;
  lobbyId: string;
  onGameStart: (gameId: string, opponentName: string, isAiGame: boolean) => void;
  setQueueSize: (size: number) => void;
  setIsHost: (isHost: boolean) => void;
  setTriggering: (triggering: boolean) => void;
  triggering: boolean;
}

export function useMatchmaking({
  playerId,
  lobbyId,
  onGameStart,
  setQueueSize,
  setIsHost,
  setTriggering,
  triggering,
}: UseMatchmakingProps) {
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

  const enterQueue = async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
      
    try {
      await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'queue',
          playerId,
          lobbyId,
        }),
      });
        
    } catch (err) {
      console.error('Queue error:', err);
    }
  };

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
      }
    } catch (err) {
      console.error('Trigger error:', err);
      alert('Failed to trigger matches');
    } finally {
      setTriggering(false);
    }
  };

  return { checkHostStatus, fetchQueueSize, enterQueue, triggerMatch };
}
