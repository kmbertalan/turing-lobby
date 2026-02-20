export interface Player {
  id: string;
  name: string;
  lobbyId: string;
  socketId?: string;
  score: number;
  gamesPlayed: number;
}

export interface Game {
  id: string;
  lobbyId: string;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  isAiGame: boolean;
  aiPersonality?: AiPersonality;
  messages: Message[];
  startedAt: number;
  endedAt?: number;
  player1Guess?: 'human' | 'ai';
  player2Guess?: 'human' | 'ai';
  player1Correct?: boolean;
  player2Correct?: boolean;
  status: 'active' | 'guessing' | 'finished';
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
}

export type AiPersonality = 'normal' | 'quirky' | 'too-perfect' | 'suspicious';

export interface Lobby {
  id: string;
  code: string;
  createdAt: number;
  maxPlayers: number;
  state: 'open' | 'closed';
  creatorId: string;
}
