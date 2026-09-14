import React from 'react';

interface ChapterSliderProps {
  progress: number;
  onProgressChange: (progress: number) => void;
}

export const ChapterSlider: React.FC<ChapterSliderProps> = ({ progress, onProgressChange }) => {
  const percentage = Math.round(progress * 100);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 p-2.5 sm:p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-30">
      <div className="max-w-4xl mx-auto flex items-center space-x-2 sm:space-x-4">
        <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">0%</span>
        
        <div className="flex-1 relative group">
          <input 
            type="range"
            aria-label="Reading position"
            min={0}
            max={100}
            value={percentage}
            onChange={(event) => onProgressChange(Number(event.target.value) / 100)}
            className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
          />
          
          {/* Tooltip */}
          <div
            className="absolute -top-10 -translate-x-1/2 bg-gray-900 dark:bg-slate-800 text-white px-3 py-1 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity border border-transparent dark:border-slate-700 shadow-md pointer-events-none"
            style={{ left: `${percentage}%` }}
          >
            {percentage}% read
          </div>
        </div>
        
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">100%</span>
      </div>
    </div>
  );
};
