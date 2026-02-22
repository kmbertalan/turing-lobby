'use client';

import { MutableRefObject, useEffect, useRef } from 'react';
import { Message } from '@/lib/types';

interface GameChatProps {
  messages: Message[];
  input: string;
  setInput: (input: string) => void;
  timeLeft: number;
  formatTime: (seconds: number) => string;
  sendMessage: () => void;
  canSend: boolean;
  playerId: string;
}

export default function GameChat({
  messages,
  input,
  setInput,
  timeLeft,
  formatTime,
  sendMessage,
  canSend,
  playerId,
}: GameChatProps) {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  return (
    <div className="relative h-screen bg-gray-900 text-white">
      <div className="fixed top-0 left-0 right-0 z-10 h-20 flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
        <div>
          <h1 className="font-bold">Anonymous Turing Test</h1>
          <p className="text-sm text-gray-400">Can you tell if you're talking to a human or AI?</p>
        </div>
        <div className="text-xl font-mono font-bold text-yellow-400">
          {formatTime(timeLeft)}
        </div>
      </div>

      <div className="absolute top-20 bottom-20 left-0 right-0 overflow-y-auto p-4 space-y-3">
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

      <div className="fixed bottom-0 left-0 right-0 z-10 p-4 bg-gray-800 border-t border-gray-700">
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
