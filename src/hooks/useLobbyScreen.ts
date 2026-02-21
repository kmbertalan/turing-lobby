'use client';

interface UseLobbyScreenProps {
  setLoading: (loading: boolean) => void;
  setError: (error: string) => void;
  setCreatedCode: (code: string) => void;
  onJoin: (playerId: string, lobbyId: string, code: string) => void;
  code: string;
  playerName: string;
}

export function useLobbyScreen({
  setLoading,
  setError,
  setCreatedCode,
  onJoin,
  code,
  playerName,
}: UseLobbyScreenProps) {
  const createLobby = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/lobby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create' }),
      });

      const data = await res.json();

      if (data.code) {
        setCreatedCode(data.code);
      } else {
        setError('Failed to create lobby');
      }
    } catch (err) {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const joinLobby = async () => {
    if (!code.trim() || !playerName.trim()) {
      setError('Please enter your name and lobby code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/lobby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          code: code.toUpperCase(),
          playerName: playerName.trim(),
        }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        onJoin(data.playerId, data.lobbyId, data.code);
      }
    } catch (err) {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async (name: string) => {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/lobby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          playerName: name.trim(),
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        onJoin(data.playerId, data.lobbyId, data.code);
      }
    } catch (err) {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };



  return { createLobby, joinLobby, handleCreateSubmit };
}