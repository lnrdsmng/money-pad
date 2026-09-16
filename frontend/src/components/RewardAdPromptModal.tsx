import { useEffect, useRef } from 'react';
import { X, Coins, Laptop, Heart, Play, Sparkles } from 'lucide-react';

export interface RewardAdPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWatchAd: () => void;
  title?: string;
  rewardTitle?: string;
  rewardDescription?: string;
  confirmLabel?: string;
  isPending?: boolean;
}

export function RewardAdPromptModal({
  isOpen,
  onClose,
  onWatchAd,
  title = 'Watch an Ad and claim your Reward!',
  rewardTitle = 'You get your reward!',
  rewardDescription = 'Watch the ad and claim your coins!',
  confirmLabel = 'Watch Ad to Claim',
  isPending = false,
}: RewardAdPromptModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const isPendingRef = useRef(isPending);

  useEffect(() => {
    onCloseRef.current = onClose;
    isPendingRef.current = isPending;
  }, [onClose, isPending]);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPendingRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reward-ad-modal-title"
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-lg rounded-3xl bg-[#FAF9F6] dark:bg-slate-900 border-2 border-[#F5E9DA] dark:border-slate-800 shadow-2xl p-5 sm:p-7 text-slate-900 dark:text-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Mascot & Heading Header */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
          {/* Mascot Art badge */}
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-2xl bg-[#F5E9DA] dark:bg-slate-800 border-2 border-amber-200 dark:border-slate-700 flex items-center justify-center shadow-inner group">
            <span className="text-3xl sm:text-4xl select-none animate-float" role="img" aria-label="Reading cat mascot">
              🐱📖
            </span>
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 text-[9px] text-white items-center justify-center font-bold">✨</span>
            </span>
          </div>

          <div className="text-center sm:text-left">
            <div className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
              <Sparkles className="w-3.5 h-3.5" /> Support & Earn
            </div>
            <h2 id="reward-ad-modal-title" className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 leading-tight">
              {title}
            </h2>
          </div>
        </div>

        {/* Explanation Subtitle */}
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 text-center sm:text-left leading-relaxed mb-5 sm:mb-6 bg-white/70 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
          By watching a short ad, you're not just earning your reward — you're also helping support our system and{' '}
          <strong className="text-primary font-bold">keep the website free for everyone! ♡</strong>
        </p>

        {/* 3 Benefit Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {/* Card 1: Reward */}
          <div className="rounded-2xl p-3.5 sm:p-4 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex flex-col items-center text-center shadow-xs">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2 shadow-xs">
              <Coins className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 mb-1">
              {rewardTitle}
            </h3>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
              {rewardDescription}
            </p>
          </div>

          {/* Card 2: Platform Support */}
          <div className="rounded-2xl p-3.5 sm:p-4 bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 flex flex-col items-center text-center shadow-xs">
            <div className="w-10 h-10 rounded-full bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-2 shadow-xs">
              <Laptop className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 mb-1">
              Keeps Us Free
            </h3>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
              Ads cover server and operational costs for all readers.
            </p>
          </div>

          {/* Card 3: Community */}
          <div className="rounded-2xl p-3.5 sm:p-4 bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 flex flex-col items-center text-center shadow-xs">
            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-2 shadow-xs">
              <Heart className="w-5 h-5 text-accent fill-accent/20" />
            </div>
            <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 mb-1">
              Community Love
            </h3>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
              Together, we create a thriving home for storytellers!
            </p>
          </div>
        </div>

        {/* Primary CTA Button (Golden/Amber Pill styled like design) */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={onWatchAd}
            disabled={isPending}
            className="w-full group relative inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-slate-950 font-black text-sm sm:text-base py-3.5 px-6 shadow-md hover:shadow-lg active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <span className="w-7 h-7 rounded-full bg-white/40 flex items-center justify-center shadow-inner">
              <Play className="w-3.5 h-3.5 fill-slate-950 ml-0.5" />
            </span>
            <span>{confirmLabel}</span>
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </button>

          {/* Bottom Community Thank You Note */}
          <p className="text-center text-[11px] text-slate-500 dark:text-slate-400">
            — ♡ Thanks for being part of our community! ♡ —
          </p>
        </div>
      </div>
    </div>
  );
}
