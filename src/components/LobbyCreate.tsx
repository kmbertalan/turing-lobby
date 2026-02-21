'use client';

interface LobbyCreateProps {
  playerName: string;
  setPlayerName: (name: string) => void;
  loading: boolean;
  error: string;
  onBack: () => void;
  onSubmit: (name: string) => Promise<void>;
}

export default function LobbyCreate({ playerName, setPlayerName, loading, error, onBack, onSubmit }: LobbyCreateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-900 text-white">
      <div className="max-w-md w-full">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white mb-4"
        >
          ← Back
        </button>

        <h2 className="text-2xl font-bold mb-6">Create a Lobby</h2>

        <div className="space-y-4">
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => onSubmit(playerName)}
            disabled={loading || !playerName.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg"
          >
            {loading ? 'Creating...' : 'Create Lobby'}
          </button>
        </div>

        {error && <p className="text-red-400 mt-4 text-center">{error}</p>}
      </div>
    </div>
  );
}
