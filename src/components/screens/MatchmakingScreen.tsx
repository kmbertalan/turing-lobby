'use client';

import { useEffect, useState, useRef } from 'react';
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

  const lastIndexRef = useRef(0);

  const handleGameStart = (data: any) => {
    if (gameStartedRef.current) return;
    gameStartedRef.current = true;
    onGameStart(data.gameId, data.opponentName, data.isAiGame);
  };

  const gameStartedRef = useRef(false);

  const { checkHostStatus, fetchQueueSize, enterQueue, triggerMatch } = useMatchmaking({
    playerId,
    lobbyId,
    onGameStart,
    setQueueSize,
    setIsHost,
    setTriggering,
    triggering,
  });

  useEffect(() => {
    if (gameStartedRef.current) return;
    
    checkHostStatus();
    fetchQueueSize();
    enterQueue();

    const queueUpdateInterval = setInterval(fetchQueueSize, 2000);

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/events?playerId=${playerId}&lastIndex=${lastIndexRef.current}`);
        if (!res.ok) return;
        const data = await res.json();
        for (const event of data.events) {
          if (event.type === 'game-start') {
            handleGameStart(event.payload);
          }
        }
        lastIndexRef.current = data.nextIndex;
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 1500);

    return () => {
      clearInterval(queueUpdateInterval);
      clearInterval(pollInterval);
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
