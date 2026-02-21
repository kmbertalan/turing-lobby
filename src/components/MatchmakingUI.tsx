'use client';

interface MatchmakingUIProps {
  dots: number;
  lobbyCode: string;
  queueSize: number;
  isHost: boolean;
  triggering: boolean;
  triggerMatch: () => void;
}

export default function MatchmakingUI({
  dots,
  lobbyCode,
  queueSize,
  isHost,
  triggering,
  triggerMatch,
}: MatchmakingUIProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-900 text-white">
      <div className="text-center">
        <div className="mb-8">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        </div>
        
        <h2 className="text-2xl font-bold mb-2">
          Waiting in Lobby{'.'.repeat(dots)}
        </h2>
        
        <div className="bg-gray-800 p-4 rounded-lg mb-4">
          <p className="text-gray-400 text-sm mb-1">Lobby Code:</p>
          <p className="text-2xl font-mono font-bold tracking-wider">{lobbyCode}</p>
        </div>
        
        <p className="text-gray-400 mb-4">
          Players in queue: <span className="text-white font-bold">{queueSize}</span>
        </p>
        
        {isHost && (
          <div className="mb-6">
            <p className="text-sm text-yellow-400 mb-3">You are the lobby host</p>
            <button
              onClick={triggerMatch}
              disabled={triggering || queueSize < 2}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3 px-8 rounded-lg text-lg disabled:cursor-not-allowed"
            >
              {triggering ? 'Starting Games...' : `Start Games (${queueSize} players)`}
            </button>
            {queueSize < 2 && (
              <p className="text-sm text-gray-500 mt-2">Need at least 2 players to start</p>
            )}
          </div>
        )}
        
        {!isHost && (
          <p className="text-sm text-gray-500 mb-4">Waiting for host to start the games...</p>
        )}
        
        <div className="mt-8 text-sm text-gray-500">
          <p>Tip: The lobby host will start the games when ready</p>
          <p>Games are 2 minutes long with AI/human guessing</p>
        </div>
      </div>
    </div>
  );
}
