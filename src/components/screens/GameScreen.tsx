'use client';

import { useState, useEffect } from 'react';
import { pusherClient } from '@/lib/pusher';
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
  const [timeLeft, setTimeLeft] = useState(10);
  const [phase, setPhase] = useState<'chatting' | 'guessing' | 'result'>('chatting');
  const [myGuess, setMyGuess] = useState<'human' | 'ai' | null>(null);
  const [result, setResult] = useState<any>(null);

 

  useEffect(() => {
    const channel = pusherClient.subscribe(`player-${playerId}`);
    
    channel.bind('message', (message: Message) => {
      if (message.senderId === playerId) return;
      setMessages(prev => [...prev, message]);
    });

    channel.bind('game-update', (data: any) => {
      if (data.result) {
        setPhase('result');
        setResult(data.result);
      } else if (data.yourGuess) {
        setMyGuess(data.yourGuess);
        setPhase('guessing');
      }
    });

    return () => {
      channel.unbind_all();
      pusherClient.unsubscribe(`player-${playerId}`);
    };
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
    return <GameResult isAiGame={isAiGame} result={result} onGameEnd={onGameEnd} />;
  }

  if (phase === 'guessing') {
    return <GameGuessing opponentName={opponentName} myGuess={myGuess} submitGuess={submitGuess} />;
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
