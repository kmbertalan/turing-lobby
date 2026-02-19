'use client';

import { useState, useEffect } from 'react';

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

  // Auto-create lobby when entering create mode
  useEffect(() => {
    if (mode === 'create' && !createdCode && !loading) {
      createLobby();
    }
  }, [mode]);

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

  if (mode === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-900 text-white">
        <div className="max-w-md w-full text-center">
          <h1 className="text-4xl font-bold mb-2">Turing Lobby</h1>
          <p className="text-gray-400 mb-8">A private social Turing test game</p>

          <div className="space-y-4">
            <button
              onClick={() => setMode('create')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg text-lg"
            >
              Create Lobby
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg text-lg"
            >
              Join Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'create') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-900 text-white">
        <div className="max-w-md w-full">
          <button
            onClick={() => {
              setMode(null);
              setCreatedCode('');
            }}
            className="text-gray-400 hover:text-white mb-4"
          >
            ← Back
          </button>

          <h2 className="text-2xl font-bold mb-6">Create a Lobby</h2>

          {loading ? (
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">Creating lobby...</p>
            </div>
          ) : createdCode ? (
            <div className="text-center">
              <p className="text-gray-400 mb-4">Share this code with friends:</p>
              <div className="bg-gray-800 p-6 rounded-lg mb-6">
                <p className="text-4xl font-mono font-bold tracking-wider">{createdCode}</p>
              </div>
              
              <div className="space-y-4">
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={async () => {
                    if (!playerName.trim()) {
                      setError('Please enter your name');
                      return;
                    }
                    setCode(createdCode);
                    setLoading(true);
                    setError('');
                    try {
                      const res = await fetch('/api/lobby', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          action: 'join',
                          code: createdCode,
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
                  }}
                  disabled={loading || !playerName.trim()}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg"
                >
                  {loading ? 'Joining...' : 'Join Your Lobby'}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-red-400 text-center">Failed to create lobby. Please go back and try again.</p>
          )}

          {error && <p className="text-red-400 mt-4 text-center">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-900 text-white">
      <div className="max-w-md w-full">
        <button
          onClick={() => setMode(null)}
          className="text-gray-400 hover:text-white mb-4"
        >
          ← Back
        </button>

        <h2 className="text-2xl font-bold mb-6">Join a Lobby</h2>

        <div className="space-y-4">
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Enter lobby code"
            className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            maxLength={6}
          />
          <button
            onClick={joinLobby}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg"
          >
            {loading ? 'Joining...' : 'Join Lobby'}
          </button>
        </div>

        {error && <p className="text-red-400 mt-4 text-center">{error}</p>}
      </div>
    </div>
  );
}
