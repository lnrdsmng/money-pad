import React, { useState } from 'react';
import { CheckCircle, LoaderCircle, PlayCircle, X } from 'lucide-react';

interface MockRewardedAdProps {
  onComplete: () => void;
  onCancel?: () => void;
  isCompleting?: boolean;
}

export const MockRewardedAd = ({ onComplete, onCancel, isCompleting = false }: MockRewardedAdProps) => {
  const [timeLeft, setTimeLeft] = useState(5);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);

  React.useEffect(() => {
    if (!playing || timeLeft <= 0) return;

    const timer = window.setTimeout(() => {
      if (timeLeft === 1) {
        setDone(true);
        setPlaying(false);
      }
      setTimeLeft((remaining) => Math.max(0, remaining - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [playing, timeLeft]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black">
      {onCancel && !playing && !done && (
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-5 top-5 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
          aria-label="Close advertisement"
        >
          <X className="h-6 w-6" />
        </button>
      )}
      {!playing && !done && (
        <button onClick={() => setPlaying(true)} className="bg-primary text-white rounded-full p-4 flex items-center space-x-2">
          <PlayCircle className="w-8 h-8" />
          <span className="text-xl font-bold">Play Ad</span>
        </button>
      )}
      
      {playing && (
        <div className="text-center text-white">
          <div className="w-64 h-36 bg-gray-800 rounded flex items-center justify-center mb-4">
            <span className="text-gray-400">Video Ad Playing...</span>
          </div>
          <p className="text-xl font-bold">Reward in {timeLeft}s</p>
        </div>
      )}

      {done && (
        <div className="text-center text-white space-y-4">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
          <p className="text-xl font-bold">Reward Granted!</p>
          <button
            type="button"
            onClick={onComplete}
            disabled={isCompleting}
            className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-2 font-bold text-black disabled:opacity-60"
          >
            {isCompleting && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {isCompleting ? 'Crediting income...' : 'Claim reward'}
          </button>
        </div>
      )}
    </div>
  );
};
