import { Coins } from 'lucide-react';

interface ReadingCoinIndicatorProps {
  pendingEarned: number;
  progress: number; // 0 to 1
  isPaused: boolean;
  isConfirming: boolean;
  isEndOfChapter: boolean;
  latestAward: number | null;
}

export function ReadingCoinIndicator({
  pendingEarned,
  progress,
  isPaused,
  isConfirming,
  isEndOfChapter,
  latestAward,
}: ReadingCoinIndicatorProps) {
  // SVG circular dimensions
  const size = 56;
  const strokeWidth = 4;
  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  // If end of chapter, circle is fully solid. Otherwise strokeDashoffset reflects 0..1 progress
  const strokeDashoffset = isEndOfChapter
    ? 0
    : circumference * (1 - Math.min(1, Math.max(0, progress)));

  const displayTotal =
    pendingEarned % 1 === 0 ? pendingEarned.toString() : pendingEarned.toFixed(2);
  const progressPercentage = Math.round((isEndOfChapter ? 1 : Math.min(1, Math.max(0, progress))) * 100);

  const awardText =
    latestAward !== null
      ? `+${latestAward % 1 === 0 ? latestAward : latestAward.toFixed(1)} ${
          latestAward === 1 ? 'coin' : 'coins'
        }`
      : null;

  return (
    <div className="relative flex flex-col items-end select-none" aria-live="polite">
      {/* Floating Award Fade Notification (+X coin/coins) */}
      {latestAward !== null && latestAward > 0 && (
        <div
          key={`${latestAward}-${pendingEarned}`}
          className="absolute -top-7 right-0 pointer-events-none z-50 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary text-white text-xs font-black shadow-lg animate-coin-award whitespace-nowrap"
        >
          <Coins className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300 shrink-0" />
          <span>{awardText}</span>
        </div>
      )}

      {/* Circular Progress Container */}
      <div
        className={`relative w-14 h-14 rounded-full bg-white/95 dark:bg-slate-900/95 border border-gray-200 dark:border-slate-800 backdrop-blur shadow-md sm:shadow-lg flex items-center justify-center transition-all ${
          isPaused && !isEndOfChapter ? 'opacity-70' : 'opacity-100'
        }`}
        title={
          isEndOfChapter
            ? 'End of chapter reached'
            : isPaused
            ? 'Reading timer paused due to inactivity'
            : isConfirming
            ? 'Confirming pending Reader Coins'
            : `Reading active: ${displayTotal} pending Reader Coins`
        }
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="absolute inset-0 -rotate-90 transform"
        >
          {/* Background Track Circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            strokeWidth={strokeWidth}
            fill="transparent"
            className="text-gray-100 dark:text-slate-800 stroke-current"
          />

          {/* Progress Indicator Circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={`stroke-current transition-all duration-300 ${
              isEndOfChapter
                ? 'text-gray-400 dark:text-slate-600'
                : isPaused
                ? 'text-amber-400'
                : 'text-primary'
            }`}
          />
        </svg>

        {/* Center of circle: Total Coins & Icon */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center">
          <Coins className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 mb-0.5" />
          <span
            className="text-xs font-bold text-gray-800 dark:text-gray-100 leading-none"
            data-testid="reading-coin-total"
          >
            {displayTotal}
          </span>
          <span className="mt-0.5 text-[9px] font-semibold leading-none text-gray-500 dark:text-gray-400">
            {progressPercentage}%
          </span>
        </div>
      </div>

      {/* Paused / End of Chapter State Badge */}
      {isEndOfChapter ? (
        <span className="mt-1 text-[10px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full border border-gray-200 dark:border-slate-700">
          Done
        </span>
      ) : isConfirming ? (
        <span className="mt-1 text-[10px] font-semibold text-primary bg-green-50 dark:bg-green-950/60 px-1.5 py-0.5 rounded-full border border-green-200 dark:border-green-800">
          Confirming
        </span>
      ) : isPaused ? (
        <span className="mt-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
          Paused
        </span>
      ) : null}
    </div>
  );
}
