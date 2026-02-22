'use client';

interface GameResultProps {
  isAiGame: boolean;
  result: {
    isAiGame: boolean;
    youCorrect: boolean;
    opponentCorrect?: boolean;
    timedOut?: boolean;
  } | null;
  onGameEnd: () => void;
  opponentName: string;
}

export default function GameResult({ isAiGame, result, onGameEnd, opponentName }: GameResultProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-900 text-white">
      <div className="max-w-md w-full bg-gray-800 rounded-lg p-6 text-center">
        <h2 className="text-2xl font-bold mb-4">Result</h2>
        
        <div className="mb-4">
          {isAiGame ? (
            <p className="text-lg">Your opponent was: <span className="font-bold text-blue-400">AI</span></p>
          ) : (
            <p className="text-lg">Your opponent was: <span className="font-bold text-green-400">{opponentName}</span></p>
          )}
        </div>
        
        <div className="mb-6">
          {result?.youCorrect ? (
            <p className="text-green-400 text-xl font-bold">You guessed correctly!</p>
          ) : (
            <p className="text-red-400 text-xl font-bold">You guessed wrong</p>
          )}
          {!isAiGame && result?.opponentCorrect !== undefined && (
            <p className="text-sm text-gray-300 mt-2">
              {opponentName} {result.opponentCorrect ? 'guessed correctly!' : 'guessed wrong'}
            </p>
          )}
        </div>

        <button
          onClick={onGameEnd}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg"
        >
          Play Again
        </button>
      </div>
    </div>
  );
}
