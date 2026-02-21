'use client';

import { Dispatch, SetStateAction } from 'react';
import { Message } from "@/lib/types";

interface UseGameScreenProps {
    playerId: string;
    gameId: string;
    input: string;
    canSend: boolean;
    setMessages: Dispatch<SetStateAction<Message[]>>;
    setInput: (input: string) => void;
    setMyGuess: (guess: 'human' | 'ai' | null) => void;
}

export function useGameScreen({
    playerId,
    gameId,
    input,
    canSend,
    setMessages,
    setInput,
    setMyGuess,
}: UseGameScreenProps) {
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

    return { sendMessage, submitGuess, formatTime };
}
