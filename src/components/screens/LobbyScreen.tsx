'use client';

import { useState, useEffect } from 'react';
import { useLobbyScreen } from '@/hooks/useLobbyScreen';
import LobbyWelcome from '../LobbyWelcome';
import LobbyCreate from '../LobbyCreate';
import LobbyJoin from '../LobbyJoin';

interface LobbyScreenProps {
  onJoin: (playerId: string, lobbyId: string, code: string) => void;
}

export default function LobbyScreen({ onJoin }: LobbyScreenProps) {
  const [mode, setMode] = useState<'create' | 'join' | null>(null);
  const [code, setCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdCode, setCreatedCode] = useState('');

  const { createLobby, joinLobby, handleCreateSubmit } = useLobbyScreen({
    setLoading,
    setError,
    setCreatedCode,
    onJoin,
    code,
    playerName,
  });

  // Auto-create lobby when entering create mode
  useEffect(() => {
    if (mode === 'create' && !createdCode && !loading) {
      createLobby();
    }
  }, [mode]);

  if (mode === null) {
    return <LobbyWelcome onCreate={() => setMode('create')} onJoin={() => setMode('join')} />;
  }

  if (mode === 'create') {
    return (
      <LobbyCreate
        playerName={playerName}
        setPlayerName={setPlayerName}
        loading={loading}
        error={error}
        onBack={() => setMode(null)}
        onSubmit={handleCreateSubmit}
      />
    );
  }

  return (
    <LobbyJoin
      playerName={playerName}
      setPlayerName={setPlayerName}
      code={code}
      setCode={setCode}
      loading={loading}
      error={error}
      onBack={() => setMode(null)}
      onSubmit={joinLobby}
    />
  );
}
