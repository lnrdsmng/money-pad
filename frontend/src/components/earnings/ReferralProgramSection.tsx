import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Gift,
  Copy,
  Check,
  Clock,
  Coins,
  Sparkles,
  Users,
  Award,
  ArrowRight,
  LoaderCircle,
} from 'lucide-react';
import http from '../../api/http';
import { useAuth } from '../../auth/AuthProvider';
import { useFeedback } from '../feedback/feedback';
import { getApiErrorMessage } from '../../utils/apiError';

export const ReferralProgramSection = () => {
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const feedback = useFeedback();

  const [copied, setCopied] = useState(false);
  const [welcomeCode, setWelcomeCode] = useState(() => localStorage.getItem('pending_referral_code') || '');
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);

  // 24-hour grace period calculation
  const signupTimestamp = (user?.signupTimestamp && Number(user.signupTimestamp) > 0)
    ? Number(user.signupTimestamp)
    : (user?.created_at ? new Date(user.created_at).getTime() : null);

  const isEligible = !user?.referredBy && !user?.isReferralRewardClaimed && signupTimestamp !== null;
  const canClaimWelcome = Boolean(timeLeft && isEligible);

  useEffect(() => {
    if (!isEligible || signupTimestamp === null) {
      return;
    }

    const updateCountdown = () => {
      const remainingMs = 86400000 - (Date.now() - signupTimestamp);
      if (remainingMs <= 0) {
        setTimeLeft(null);
        return;
      }

      const totalSeconds = Math.floor(remainingMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      setTimeLeft({ hours, minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [isEligible, signupTimestamp]);

  // Fetch milestones progress
  const { data: milestonesData, isLoading: loadingMilestones } = useQuery({
    queryKey: ['referralMilestones'],
    queryFn: async () => {
      const res = await http.get('/referrals/milestones');
      return res.data;
    },
    enabled: !!user,
  });

  // Claim welcome bonus mutation
  const claimWelcomeMutation = useMutation({
    mutationFn: async () => {
      const res = await http.post('/referrals/claim-welcome', {
        referral_code: welcomeCode.trim(),
      });
      return res.data;
    },
    onSuccess: (data) => {
      feedback.success('🎉 10 Reader Coins added to your balance!');
      if (data.user) updateUser(data.user);
      setWelcomeCode('');
      localStorage.removeItem('pending_referral_code');
      queryClient.invalidateQueries({ queryKey: ['referralMilestones'] });
    },
    onError: (error) => {
      feedback.error(getApiErrorMessage(error, 'Could not claim welcome bonus.'));
    },
  });

  // Claim milestone mutation
  const claimMilestoneMutation = useMutation({
    mutationFn: async (tierIndex: number) => {
      const res = await http.post('/referrals/claim-milestone', {
        tier_index: tierIndex,
      });
      return res.data;
    },
    onSuccess: (data) => {
      feedback.success(data.message || 'Milestone reward claimed!');
      queryClient.invalidateQueries({ queryKey: ['referralMilestones'] });
      // Update reader coins in auth state
      if (data.readerCoins !== undefined && user) {
        updateUser({ ...user, readerCoins: data.readerCoins });
      }
    },
    onError: (error) => {
      feedback.error(getApiErrorMessage(error, 'Failed to claim milestone reward.'));
    },
  });

  const referralLink = `${window.location.origin}/register?ref=${user?.username}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      feedback.success('Referral link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      feedback.error('Could not copy link.');
    }
  };

  const tiers = milestonesData?.tiers || [];

  return (
    <div className="space-y-6 my-8">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Gift className="w-6 h-6 text-primary" />
          Referral Rewards & Milestone Program
        </h2>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Invite friends to earn up to 550 Reader Coins per active reader + 5% lifetime author commission!
        </p>
      </div>

      {/* 24-HOUR WELCOME BONUS CARD */}
      {canClaimWelcome && timeLeft && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-5 h-5 text-amber-200" />
                <h3 className="font-bold text-lg">24-Hour Welcome Bonus</h3>
                <span className="bg-white/20 text-white text-xs px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')} left
                </span>
              </div>
              <p className="text-xs sm:text-sm text-amber-100 max-w-lg">
                Enter your friend's username or referral code to claim <strong>10 instant Reader Coins</strong>!
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (welcomeCode.trim()) claimWelcomeMutation.mutate();
              }}
              className="flex w-full sm:w-auto gap-2"
            >
              <input
                type="text"
                required
                placeholder="Friend's username"
                value={welcomeCode}
                onChange={(e) => setWelcomeCode(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white text-gray-900 text-xs sm:text-sm placeholder:text-gray-400 focus:outline-none w-full sm:w-44"
              />
              <button
                type="submit"
                disabled={!welcomeCode.trim() || claimWelcomeMutation.isPending}
                className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-black transition shrink-0 disabled:opacity-60 cursor-pointer flex items-center gap-1"
              >
                {claimWelcomeMutation.isPending ? <LoaderCircle className="w-4 h-4 animate-spin" /> : 'Claim 10 Coins'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SHAREABLE INVITE & COMMISSION CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Share Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-1">
              <Users className="w-5 h-5 text-primary" />
              Your Shareable Referral Link
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Share this link with fellow book lovers and writers to earn passive coins and income.
            </p>

            <div className="flex items-center gap-2 p-2 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 mb-3">
              <span className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate flex-1 pl-2">
                {referralLink}
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-green-600 transition flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t border-gray-100 dark:border-slate-700">
            <span>Referral Code: <strong className="text-gray-900 dark:text-gray-100">@{user?.username}</strong></span>
            <span>Total Referrals: <strong className="text-primary">{user?.referralCount || 0}</strong></span>
          </div>
        </div>

        {/* 5% Author Referral Commission Callout */}
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/20 rounded-2xl p-6 border border-purple-200 dark:border-purple-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                Lifetime Perk
              </span>
              <Award className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="font-bold text-base sm:text-lg text-purple-950 dark:text-purple-100 mb-1">
              5% Author Referral Commission
            </h3>
            <p className="text-xs text-purple-800 dark:text-purple-300 leading-relaxed">
              When an author who signed up with your referral link withdraws their story earnings, you automatically receive a <strong>5% lifetime bonus</strong> added to your referral balance without reducing their payout!
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-purple-200 dark:border-purple-800/60 text-xs text-purple-900 dark:text-purple-200 font-semibold flex items-center gap-1">
            <span>Paid out automatically upon their withdrawal approvals</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* 6-TIER MILESTONE REWARDS TABLE */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-200 dark:border-slate-700 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
          <div>
            <h3 className="font-bold text-base sm:text-lg text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-500" />
              Activity Milestone Rewards
            </h3>
            <p className="text-xs text-gray-500">
              Track chapters read and ads watched by your referred friends. Claim coins as milestones unlock!
            </p>
          </div>

          {milestonesData && (
            <div className="flex gap-4 text-xs font-semibold text-gray-600 dark:text-gray-400">
              <span>Chapters: <strong className="text-primary">{milestonesData.totalChaptersRead}</strong></span>
              <span>Ads: <strong className="text-primary">{milestonesData.totalAdsWatched}</strong></span>
            </div>
          )}
        </div>

        {loadingMilestones ? (
          <div className="text-center py-8 text-xs text-gray-500">Loading milestone progress...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-700 text-gray-400 uppercase tracking-wider">
                  <th className="py-3 px-3 font-semibold">Tier</th>
                  <th className="py-3 px-3 font-semibold">Requirements</th>
                  <th className="py-3 px-3 font-semibold">Progress</th>
                  <th className="py-3 px-3 font-semibold">Reward</th>
                  <th className="py-3 px-3 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
                {tiers.map((tier: any) => (
                  <tr key={tier.tier} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="py-3.5 px-3 font-bold text-gray-900 dark:text-gray-100">
                      Tier {tier.tier}
                    </td>
                    <td className="py-3.5 px-3 text-gray-600 dark:text-gray-300">
                      {tier.targetChapters} chapters + {tier.targetAds} ads
                    </td>
                    <td className="py-3.5 px-3 text-gray-500">
                      <div className="flex items-center gap-2">
                        <div className="w-20 sm:w-28 h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{
                              width: `${Math.min(
                                100,
                                ((tier.currentChapters / tier.targetChapters) * 50) +
                                ((tier.currentAds / tier.targetAds) * 50)
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] whitespace-nowrap">
                          {tier.currentChapters}/{tier.targetChapters} ch • {tier.currentAds}/{tier.targetAds} ads
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-bold text-amber-500 flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5" />
                      +{tier.coins} Coins
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      {tier.isClaimed ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-gray-400">
                          Claimed ✓
                        </span>
                      ) : tier.canClaim ? (
                        <button
                          type="button"
                          onClick={() => claimMilestoneMutation.mutate(tier.tier)}
                          disabled={claimMilestoneMutation.isPending}
                          className="px-3 py-1 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 transition shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          Claim Reward
                        </button>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-gray-50 text-gray-400 border border-gray-200 dark:border-slate-700">
                          In Progress
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReferralProgramSection;
