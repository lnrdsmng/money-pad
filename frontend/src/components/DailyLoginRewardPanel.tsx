import { useState } from 'react';
import { CalendarCheck, Check, LoaderCircle, LockKeyhole, X, Gift } from 'lucide-react';
import { useDailyLoginReward } from '../hooks/useDailyLoginReward';

interface DailyLoginRewardPanelProps {
  isDismissible?: boolean;
  onDismiss?: () => void;
}

export function DailyLoginRewardPanel({ isDismissible = true, onDismiss }: DailyLoginRewardPanelProps) {
  const {
    claimMutation,
    availableDay,
    claimedToday,
    serverDate,
    days,
    eligible,
  } = useDailyLoginReward();

  const [isDismissed, setIsDismissed] = useState(false);

  if (!eligible || !days.some((day) => ['available', 'upcoming'].includes(day.status))) {
    return null;
  }

  // If dismissed today, respect dismissal until daily reset
  const todayKey = serverDate || new Date().toISOString().split('T')[0];
  const isLocallyDismissed = Boolean(
    typeof window !== 'undefined' && localStorage.getItem(`dismissed_daily_reward_${todayKey}`) === 'true'
  );
  if (isDismissed || isLocallyDismissed) {
    return null;
  }

  const handleDismiss = () => {
    const key = serverDate || new Date().toISOString().split('T')[0];
    localStorage.setItem(`dismissed_daily_reward_${key}`, 'true');
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <section className="relative mx-auto mt-2 mb-6 w-full max-w-7xl rounded-2xl border border-amber-200/70 dark:border-amber-900/40 bg-[#F5E9DA]/50 dark:bg-amber-950/20 p-4 sm:p-5 shadow-xs">
      {isDismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 rounded-full text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-200/50 dark:hover:bg-stone-800/50 transition cursor-pointer"
          title="Dismiss banner"
          aria-label="Dismiss daily reward banner"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between pr-6">
        <div>
          <h2 className="flex items-center gap-2 text-sm sm:text-base font-bold text-stone-900 dark:text-amber-100">
            <CalendarCheck className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
            New-Account Daily Check-in Reward
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-stone-600 dark:text-stone-300">
            Claim today in Philippine time. Missed days expire and cannot be recovered.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {days.map((day) => (
            <div
              key={day.day}
              title={`${day.date}: ${day.status}`}
              className={`min-w-14 sm:min-w-16 flex-1 sm:flex-none rounded-xl border p-1.5 sm:p-2 text-center text-xs transition-all ${
                day.status === 'available'
                  ? 'border-accent bg-white dark:bg-slate-900 ring-2 ring-accent/30 font-bold'
                  : day.status === 'claimed'
                  ? 'border-primary/40 bg-primary/10 text-primary dark:bg-primary/20'
                  : 'border-stone-200 dark:border-stone-700 bg-white/70 dark:bg-slate-800/60 text-stone-500 dark:text-stone-400'
              }`}
            >
              <p className="font-semibold text-[11px] sm:text-xs">Day {day.day}</p>
              {day.status !== 'upcoming' && (
                <p className="mt-0.5 sm:mt-1 font-bold text-[11px] sm:text-xs text-stone-900 dark:text-stone-100">{Number(day.amount)} coins</p>
              )}
              {day.status === 'claimed' && <Check className="mx-auto mt-1 h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />}
              {day.status === 'missed' && <span className="mt-1 block text-[10px] sm:text-xs text-stone-400">Missed</span>}
              {day.status === 'upcoming' && <LockKeyhole className="mx-auto mt-1 h-3 w-3 sm:h-3.5 sm:w-3.5 text-stone-400" />}
            </div>
          ))}
        </div>

        {availableDay && (
          <button
            type="button"
            disabled={claimMutation.isPending}
            onClick={() => claimMutation.mutate()}
            className="inline-flex w-full sm:w-auto shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-white hover:bg-accent-hover shadow-xs active:scale-98 transition disabled:opacity-60 cursor-pointer"
          >
            {claimMutation.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
            Claim {Number(availableDay.amount)} coins
          </button>
        )}

        {claimedToday && (
          <p className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary/10 border border-primary/20 px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-primary text-center">
            <Check className="h-4 w-4 shrink-0" />
            Today's reward claimed
          </p>
        )}
      </div>

      {claimMutation.isError && (
        <p className="mt-3 text-xs sm:text-sm text-red-600 font-medium">
          Today's reward could not be claimed. Refresh and try again.
        </p>
      )}
    </section>
  );
}

export function CompactDailyRewardCard() {
  const {
    claimMutation,
    availableDay,
    claimedToday,
    eligible,
    days,
  } = useDailyLoginReward();

  if (!eligible || !days.some((day) => ['available', 'upcoming'].includes(day.status))) {
    return null;
  }

  const currentOrUpcomingDay = days.find((d) => d.status === 'available') || days.find((d) => d.status === 'upcoming');

  return (
    <div className="rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-[#F5E9DA]/50 dark:bg-amber-950/20 p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
          <Gift className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
            Daily Login Check-in
            {availableDay && (
              <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse" />
            )}
          </h4>
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
            {availableDay
              ? `Day ${availableDay.day} ready to claim (${Number(availableDay.amount)} coins)`
              : claimedToday
              ? "You've claimed today's login reward! Come back tomorrow."
              : currentOrUpcomingDay
              ? `Next reward unlocks on Day ${currentOrUpcomingDay.day}`
              : "Check-in program completed"}
          </p>
        </div>
      </div>

      <div className="w-full sm:w-auto shrink-0">
        {availableDay ? (
          <button
            type="button"
            disabled={claimMutation.isPending}
            onClick={() => claimMutation.mutate()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white hover:bg-accent-hover transition cursor-pointer shadow-xs disabled:opacity-60"
          >
            {claimMutation.isPending && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
            Claim {Number(availableDay.amount)} coins
          </button>
        ) : claimedToday ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg">
            <Check className="w-3.5 h-3.5" />
            Claimed Today
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default DailyLoginRewardPanel;

