'use client';

interface LobbyWelcomeProps {
  onCreate: () => void;
  onJoin: () => void;
}

export default function LobbyWelcome({ onCreate, onJoin }: LobbyWelcomeProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-900 text-white">
      <div className="max-w-md w-full text-center">
        <h1 className="text-4xl font-bold mb-2">Turing Lobby</h1>
        <p className="text-gray-400 mb-8">A private social Turing test game</p>

        <div className="space-y-4">
          <button
            onClick={onCreate}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg text-lg"
          >
            Create Lobby
          </button>
          <button
            onClick={onJoin}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg text-lg"
          >
            Join Lobby
          </button>
        </div>
      </div>
    </div>
  );
}
