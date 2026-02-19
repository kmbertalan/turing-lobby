'use client';

import { useState } from 'react';
import LobbyScreen from '@/components/LobbyScreen';
import MatchmakingScreen from '@/components/MatchmakingScreen';
import GameScreen from '@/components/GameScreen';

type Screen = 'lobby' | 'matchmaking' | 'game';

export default function Home() {
  const [screen, setScreen] = useState<Screen>('lobby');
  const [playerId, setPlayerId] = useState('');
  const [lobbyId, setLobbyId] = useState('');
  const [lobbyCode, setLobbyCode] = useState('');
  const [gameId, setGameId] = useState('');
  const [opponentName, setOpponentName] = useState('');
  const [isAiGame, setIsAiGame] = useState(false);

  const handleJoinLobby = (pid: string, lid: string, code: string) => {
    setPlayerId(pid);
    setLobbyId(lid);
    setLobbyCode(code);
    setScreen('matchmaking');
  };

  const handleGameStart = (gid: string, opponent: string, aiGame: boolean) => {
    setGameId(gid);
    setOpponentName(opponent);
    setIsAiGame(aiGame);
    setScreen('game');
  };

  const handleGameEnd = () => {
    setScreen('matchmaking');
    setGameId('');
    setOpponentName('');
    setIsAiGame(false);
  };

  return (
    <main className="min-h-screen bg-gray-900">
      {screen === 'lobby' && (
        <LobbyScreen onJoin={handleJoinLobby} />
      )}
      
      {screen === 'matchmaking' && (
        <MatchmakingScreen
          playerId={playerId}
          lobbyId={lobbyId}
          onGameStart={handleGameStart}
        />
      )}
      
      {screen === 'game' && (
        <GameScreen
          gameId={gameId}
          playerId={playerId}
          opponentName={opponentName}
          isAiGame={isAiGame}
          onGameEnd={handleGameEnd}
        />
      )}
    </main>
  );
}
