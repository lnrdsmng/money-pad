import { Coins, Check, Lock, Tv, LoaderCircle, Sparkles } from 'lucide-react';
import type { ReferralTier } from '../../types/referrals';

interface ReferralMilestoneTableProps {
  tiers: ReferralTier[];
  onClaim?: (tier: number) => void;
  onWatchAd?: (tier: number) => void;
  isClaiming?: boolean;
  claimingTier?: number | null;
  isStartingAd?: boolean;
  startingAdTier?: number | null;
  mode?: 'referrer' | 'referee';
}

export function ReferralMilestoneTable({
  tiers,
  onClaim,
  onWatchAd,
  isClaiming = false,
  claimingTier = null,
  isStartingAd = false,
  startingAdTier = null,
  mode = 'referrer',
}: ReferralMilestoneTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/50">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-gray-200 dark:border-slate-700 text-gray-400 uppercase tracking-wider bg-gray-50/50 dark:bg-slate-800/40">
            <th className="py-2.5 px-3 font-semibold">Tier</th>
            <th className="py-2.5 px-3 font-semibold">Requirement (New)</th>
            <th className="py-2.5 px-3 font-semibold">Progress</th>
            <th className="py-2.5 px-3 font-semibold">Reward</th>
            <th className="py-2.5 px-3 font-semibold text-right">Status / Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
          {tiers.map((tier) => {
            const chPercent = Math.min(100, Math.round((tier.currentChapters / Math.max(1, tier.targetChapters)) * 100));
            const adPercent = Math.min(100, Math.round((tier.currentAds / Math.max(1, tier.targetAds)) * 100));
            const totalPercent = Math.round((chPercent + adPercent) / 2);

            const isCurrentClaiming = isClaiming && claimingTier === tier.tier;
            const isCurrentStartingAd = isStartingAd && startingAdTier === tier.tier;

            return (
              <tr
                key={tier.tier}
                className={`transition-colors ${
                  tier.isLocked
                    ? 'opacity-60 bg-gray-50/30 dark:bg-slate-900/20'
                    : 'hover:bg-gray-50/60 dark:hover:bg-slate-800/30'
                }`}
              >
                {/* Tier Number */}
                <td className="py-3 px-3 font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    {tier.isLocked && <Lock className="w-3 h-3 text-gray-400 shrink-0" />}
                    <span>Tier {tier.tier}</span>
                  </div>
                </td>

                {/* Requirement */}
                <td className="py-3 px-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                  {tier.targetChapters} chapters + {tier.targetAds} ads
                </td>

                {/* Progress Bar & Counts */}
                <td className="py-3 px-3 text-gray-500 min-w-36 sm:min-w-44">
                  <div className="flex items-center gap-2">
                    <div className="w-20 sm:w-28 h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden shrink-0">
                      <div
                        className={`h-full rounded-full transition-all ${
                          tier.isCompleted ? 'bg-emerald-500' : 'bg-primary'
                        }`}
                        style={{ width: `${totalPercent}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {tier.currentChapters}/{tier.targetChapters} ch • {tier.currentAds}/{tier.targetAds} ads
                    </span>
                  </div>
                </td>

                {/* Reward */}
                <td className="py-3 px-3 font-bold text-amber-500 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5" />
                    +{tier.coins} Coins
                  </span>
                </td>

                {/* Status / Action */}
                <td className="py-3 px-3 text-right whitespace-nowrap">
                  {tier.isClaimed ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                      Claimed <Check className="w-3 h-3" />
                    </span>
                  ) : mode === 'referrer' && tier.canClaim && onClaim ? (
                    <button
                      type="button"
                      onClick={() => onClaim(tier.tier)}
                      disabled={isClaiming}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 rounded-lg text-xs font-bold shadow-xs active:scale-98 transition cursor-pointer disabled:opacity-50"
                    >
                      {isCurrentClaiming ? (
                        <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      <span>Claim +{tier.coins}</span>
                    </button>
                  ) : mode === 'referee' && tier.canWatchAd && onWatchAd ? (
                    <button
                      type="button"
                      onClick={() => onWatchAd(tier.tier)}
                      disabled={isStartingAd}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold shadow-xs active:scale-98 transition cursor-pointer disabled:opacity-50"
                    >
                      {isCurrentStartingAd ? (
                        <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Tv className="w-3.5 h-3.5" />
                      )}
                      <span>Watch Ad</span>
                    </button>
                  ) : tier.isLocked ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-slate-700">
                      <Lock className="w-2.5 h-2.5" /> Locked
                    </span>
                  ) : tier.isCompleted ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                      Completed
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-slate-700">
                      In Progress
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
