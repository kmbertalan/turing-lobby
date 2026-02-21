'use client';

import { useEffect, useState, useRef } from 'react';
import { pusherClient } from '@/lib/pusher';
import { useMatchmaking } from '@/hooks/useMatchmakingScreen';
import MatchmakingUI from '../MatchmakingUI';

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
  const [dots, setDots] = useState(1);

  const [queueSize, setQueueSize] = useState(0);
  const [isHost, setIsHost] = useState(false);
  const [triggering, setTriggering] = useState(false);

  const channelRef = useRef<any>(null);
  const gameStartedRef = useRef(false);

  const { handleGameStart, checkHostStatus, fetchQueueSize, enterQueue, triggerMatch } = useMatchmaking({
    playerId,
    lobbyId,
    onGameStart,
    setQueueSize,
    setIsHost,
    setTriggering,
    triggering,
    channelRef,
    gameStartedRef,
  });

  const cleanupTimeout = setTimeout(() => {
    if (!gameStartedRef.current) {
      if (channelRef.current) {
        channelRef.current.unbind('game-start', handleGameStart);
        pusherClient.unsubscribe(`player-${playerId}`);
        channelRef.current = null;
      }
    }
  }, 120000);

  useEffect(() => {
    if (gameStartedRef.current) return;
    
    const channel = pusherClient.subscribe(`player-${playerId}`);
    channelRef.current = channel;
    
    channel.bind('game-start', handleGameStart);

    checkHostStatus();
    fetchQueueSize();
    enterQueue();

    const queueUpdateInterval = setInterval(fetchQueueSize, 2000);

    return () => {
      clearTimeout(cleanupTimeout);
      clearInterval(queueUpdateInterval);
    };
  }, [playerId, lobbyId, onGameStart]);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => (prev % 3) + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return <MatchmakingUI dots={dots} lobbyCode={lobbyCode} queueSize={queueSize} isHost={isHost} triggering={triggering} triggerMatch={triggerMatch} />;
}
