'use client';

import { useState, useEffect, useRef } from 'react';
import { pusherClient } from '@/lib/pusher';
import { Player, Game, Message } from '@/lib/types';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Subscribe to player channel
    const channel = pusherClient.subscribe(`player-${playerId}`);
    
    channel.bind('message', (message: Message) => {
      // Don't add own messages again (already added locally in sendMessage)
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

  const sendMessage = async () => {
    if (!input.trim() || !canSend) return;
    
    const message: Message = {
      id: Date.now().toString(),
      senderId: playerId,
      senderName: 'You',
      content: input,
      timestamp: Date.now(),
    };
    
    setMessages(prev => [...prev, message]);
    setInput('');

    await fetch('/api/game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'message',
        gameId,
        playerId,
        content: input,
      }),
    });
  };

  const submitGuess = async (guess: 'human' | 'ai') => {
    setMyGuess(guess);
    
    await fetch('/api/game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'guess',
        gameId,
        playerId,
        guess,
      }),
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (phase === 'result') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-900 text-white">
        <div className="max-w-md w-full bg-gray-800 rounded-lg p-6 text-center">
          <h2 className="text-2xl font-bold mb-4">Result</h2>
          
          <div className="mb-4">
            {isAiGame ? (
              <p className="text-lg">Your opponent was: <span className="font-bold text-blue-400">AI</span></p>
            ) : (
              <p className="text-lg">Your opponent was: <span className="font-bold text-green-400">Human</span></p>
            )}
          </div>
          
          <div className="mb-6">
            {result?.youCorrect ? (
              <p className="text-green-400 text-xl font-bold">You guessed correctly!</p>
            ) : (
              <p className="text-red-400 text-xl font-bold">You guessed wrong</p>
            )}
          </div>

          <button
            onClick={onGameEnd}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg"
          >
            Play Again
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'guessing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-900 text-white">
        <div className="max-w-md w-full bg-gray-800 rounded-lg p-6 text-center">
          <h2 className="text-2xl font-bold mb-4">Time's Up!</h2>
          <p className="mb-6">Was {opponentName} a human or AI?</p>
          
          {myGuess ? (
            <p className="text-lg">You guessed: <span className="font-bold capitalize">{myGuess}</span></p>
          ) : (
            <div className="flex gap-4">
              <button
                onClick={() => submitGuess('human')}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-lg"
              >
                Human
              </button>
              <button
                onClick={() => submitGuess('ai')}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg"
              >
                AI
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
        <div>
          <h1 className="font-bold">Anonymous Turing Test</h1>
          <p className="text-sm text-gray-400">Can you tell if you're talking to a human or AI?</p>
        </div>
        <div className="text-xl font-mono font-bold text-yellow-400">
          {formatTime(timeLeft)}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.senderId === playerId ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                msg.senderId === playerId
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-white'
              }`}
            >
              {msg.senderId !== playerId && (
                <p className="text-xs text-gray-400 mb-1">{msg.senderName}</p>
              )}
              <p>{msg.content}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-gray-800 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={sendMessage}
            disabled={!canSend}
            className={`px-6 py-3 rounded-lg font-bold ${
              canSend
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-400 text-gray-200 cursor-not-allowed'
            }`}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
