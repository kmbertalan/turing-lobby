'use client';

import { useState, useEffect, useRef } from 'react';
import { Message } from '@/lib/types';
import { useGameScreen } from '@/hooks/useGameScreen';
import GameResult from '../GameResult';
import GameGuessing from '../GameGuessing';
import GameChat from '../GameChat';

interface GameScreenProps {
  gameId: string;
  playerId: string;
  opponentName: string;
  isAiGame: boolean;
  onGameEnd: () => void;
}

export default function GameScreen({ 
  gameId, 
  playerId, 
  opponentName, 
  isAiGame, 
  onGameEnd 
}: GameScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(120);
  const [phase, setPhase] = useState<'chatting' | 'guessing' | 'result'>('chatting');
  const [myGuess, setMyGuess] = useState<'human' | 'ai' | null>(null);
  const [result, setResult] = useState<any>(null);

  const lastIndexRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/events?playerId=${playerId}&lastIndex=${lastIndexRef.current}`);
        if (!res.ok) return;
        const data = await res.json();
        for (const event of data.events) {
          if (event.type === 'message') {
            setMessages(prev => [...prev, event.payload]);
          } else if (event.type === 'game-update') {
            const payload = event.payload;
            if (payload.result) {
              setPhase('result');
              setResult(payload.result);
            } else if (payload.yourGuess) {
              setMyGuess(payload.yourGuess);
              setPhase('guessing');
            }
          }
        }
        lastIndexRef.current = data.nextIndex;
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [playerId]);

  // Countdown timer
  useEffect(() => {
    if (phase !== 'chatting') return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setPhase('guessing');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase]);

  const lastMessage = messages[messages.length - 1];
  const canSend = !lastMessage || lastMessage.senderId !== playerId;

  const { sendMessage, submitGuess, formatTime } = useGameScreen({
    playerId,
    gameId,
    input,
    canSend,
    setMessages,
    setInput,
    setMyGuess,
  });

  if (phase === 'result') {
    return <GameResult isAiGame={isAiGame} result={result} onGameEnd={onGameEnd} opponentName={opponentName} />;
  }

  if (phase === 'guessing') {
    return <GameGuessing opponentName={opponentName} myGuess={myGuess} submitGuess={submitGuess} setPhase={setPhase} />;
  }

  return (
    <GameChat
      messages={messages}
      input={input}
      setInput={setInput}
      timeLeft={timeLeft}
      formatTime={formatTime}
      sendMessage={sendMessage}
      canSend={canSend}
      playerId={playerId}
    />
  );
}
