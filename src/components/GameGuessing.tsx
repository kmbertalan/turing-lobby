'use client';

interface GameGuessingProps {
  opponentName: string;
  myGuess: 'human' | 'ai' | null;
  submitGuess: (guess: 'human' | 'ai') => void;
  setPhase: (phase: 'chatting' | 'guessing' | 'result') => void;
}

export default function GameGuessing({ opponentName, myGuess, submitGuess, setPhase }: GameGuessingProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-900 text-white">
      <div className="max-w-md w-full bg-gray-800 rounded-lg p-6 text-center">
        <h2 className="text-2xl font-bold mb-4">Time's Up!</h2>
        <p className="mb-6">Was your opponent a human or AI?</p>
        
        {myGuess ? (
          <p className="text-lg">You guessed: <span className="font-bold capitalize">{myGuess}</span></p>
        ) : (
          <div className="flex gap-4">
            <button
              onClick={() => submitGuess('human')}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-lg"
            >
              Human
            </button>
            <button
              onClick={() => submitGuess('ai')}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg"
            >
              AI
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
