import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Gift,
  Copy,
  Check,
  Clock,
  Coins,
  Sparkles,
  Users,
  Award,
  LoaderCircle,
  Tv,
  BookOpen,
  Lock,
  DollarSign,
  CheckCircle2,
} from 'lucide-react';
import http from '../../api/http';
import { useAuth } from '../../auth/AuthProvider';
import { MockRewardedAd } from '../MockRewardedAd';
import { useFeedback } from '../feedback/feedback';
import { getApiErrorMessage } from '../../utils/apiError';
import { parseReferralInput } from '../../utils/referral';

interface AuthorCommission {
  id: string;
  author_id: string;
  author?: {
    id: string;
    username: string;
    profileImageUrl?: string;
    isVerified?: boolean;
  };
  withdrawal_amount: number | string;
  commission_amount: number | string;
  required_ads: number;
  ads_watched: number;
  status: 'pending' | 'ready_to_claim' | 'claimed' | 'cancelled';
  claimed_at: string | null;
  created_at: string;
}

interface AuthorCommissionsResponse {
  commissions: AuthorCommission[];
  summary: {
    total_claimed: number;
    total_pending: number;
    total_ready_to_claim: number;
    total_count: number;
  };
}

interface AdWatchStatus {
  reward_coins: number;
  cooldown_seconds: number;
  cooldown_remaining: number;
  can_watch: boolean;
  available: boolean;
}

export const ReferralProgramSection = () => {
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const feedback = useFeedback();

  const [copied, setCopied] = useState(false);
  const [welcomeCode, setWelcomeCode] = useState(() => localStorage.getItem('pending_referral_code') || '');
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);

  // Milestone inline inviter link form state
  const [inlineInviterCode, setInlineInviterCode] = useState('');

  // Ad watching state
  const [activeAd, setActiveAd] = useState<{
    purpose: 'coins' | 'author_commission';
    commissionId?: string;
    adEventId: string;
  } | null>(null);
  const [startingAd, setStartingAd] = useState(false);
  const [completingAd, setCompletingAd] = useState(false);
  const [adCooldownSeconds, setAdCooldownSeconds] = useState<number | null>(null);

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
    queryKey: ['referralMilestones', user?.id],
    queryFn: async () => {
      const res = await http.get('/referrals/milestones');
      return res.data;
    },
    enabled: !!user,
  });

  // Fetch author commissions
  const { data: commissionsData, isLoading: loadingCommissions } = useQuery<AuthorCommissionsResponse>({
    queryKey: ['authorCommissions', user?.id],
    queryFn: async () => {
      const res = await http.get('/referrals/author-commissions');
      return res.data;
    },
    enabled: !!user,
  });

  // Ad watch status (for cooldown)
  const { data: adWatchStatus } = useQuery<AdWatchStatus>({
    queryKey: ['ad-watch-status', user?.id],
    queryFn: async () => (await http.get('/transactions/ad-watch/status')).data,
    enabled: !!user,
  });

  const adCooldown = adCooldownSeconds ?? (adWatchStatus?.cooldown_remaining ?? 0);

  useEffect(() => {
    if (adCooldown <= 0) return;
    const interval = setInterval(() => {
      setAdCooldownSeconds((prev) => {
        const current = (prev ?? (adWatchStatus?.cooldown_remaining ?? 0)) - 1;
        if (current <= 0) {
          clearInterval(interval);
          queryClient.invalidateQueries({ queryKey: ['ad-watch-status', user?.id] });
          return 0;
        }
        return current;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [adCooldown, queryClient, adWatchStatus?.cooldown_remaining, user?.id]);

  // Claim welcome bonus mutation
  const claimWelcomeMutation = useMutation({
    mutationFn: async () => {
      const res = await http.post('/referrals/claim-welcome', {
        referral_code: welcomeCode.trim(),
      });
      return res.data;
    },
    onSuccess: (data) => {
      feedback.success(data.message || '10 Reader Coins added to your balance!');
      if (data.user) updateUser(data.user);
      setWelcomeCode('');
      localStorage.removeItem('pending_referral_code');
      queryClient.invalidateQueries({ queryKey: ['referralMilestones', user?.id] });
    },
    onError: (error) => {
      feedback.error(getApiErrorMessage(error, 'Could not claim welcome bonus.'));
    },
  });

  // Link inviter mutation (for milestone participation anytime)
  const linkInviterMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await http.post('/referrals/link', {
        referral_code: code.trim(),
      });
      return res.data;
    },
    onSuccess: (data) => {
      feedback.success(data.message || 'Referral linked successfully!');
      if (data.user) updateUser(data.user);
      setInlineInviterCode('');
      localStorage.removeItem('pending_referral_code');
      queryClient.invalidateQueries({ queryKey: ['referralMilestones', user?.id] });
    },
    onError: (error) => {
      feedback.error(getApiErrorMessage(error, 'Could not link referral username.'));
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
      queryClient.invalidateQueries({ queryKey: ['referralMilestones', user?.id] });
      if (data.readerCoins !== undefined && user) {
        updateUser({ ...user, readerCoins: data.readerCoins });
      }
    },
    onError: (error) => {
      feedback.error(getApiErrorMessage(error, 'Failed to claim milestone reward.'));
    },
  });

  // Claim author commission mutation (credited directly to user's PHP balance)
  const claimCommissionMutation = useMutation({
    mutationFn: async (commissionId: string) => {
      const res = await http.post(`/referrals/author-commissions/${commissionId}/claim`);
      return res.data;
    },
    onSuccess: (data) => {
      feedback.success(data.message || 'Commission successfully claimed to your PHP balance!');
      if (data.user) updateUser(data.user);
      queryClient.invalidateQueries({ queryKey: ['authorCommissions', user?.id] });
    },
    onError: (error) => {
      feedback.error(getApiErrorMessage(error, 'Failed to claim author commission.'));
    },
  });

  // Start ad for milestone support
  const handleStartMilestoneAd = async () => {
    if (!user?.referredBy) {
      feedback.error('Please link a valid referral username first.');
      return;
    }
    if (adCooldown > 0) {
      feedback.error(`Please wait ${adCooldown}s for cooldown.`);
      return;
    }
    setStartingAd(true);
    try {
      const res = await http.post<{ id: string }>('/rewarded-ads', { purpose: 'coins' });
      setActiveAd({
        purpose: 'coins',
        adEventId: res.data.id,
      });
    } catch (err) {
      feedback.error(getApiErrorMessage(err, 'Rewarded ads are currently unavailable.'));
    } finally {
      setStartingAd(false);
    }
  };

  // Start ad for author commission
  const handleStartCommissionAd = async (commissionId: string) => {
    setStartingAd(true);
    try {
      const res = await http.post<{ id: string }>('/rewarded-ads', {
        purpose: 'author_commission',
        target_id: commissionId,
      });
      setActiveAd({
        purpose: 'author_commission',
        commissionId,
        adEventId: res.data.id,
      });
    } catch (err) {
      feedback.error(getApiErrorMessage(err, 'Rewarded ads are currently unavailable.'));
    } finally {
      setStartingAd(false);
    }
  };

  // On ad completed in MockRewardedAd
  const handleAdComplete = async () => {
    if (!activeAd) return;
    setCompletingAd(true);

    try {
      // 1. Verify mock ad
      await http.post(`/rewarded-ads/${activeAd.adEventId}/mock-verify`);

      // 2. Consume based on purpose
      if (activeAd.purpose === 'coins') {
        const res = await http.post('/transactions/ad-watch', {
          ad_event_id: activeAd.adEventId,
        });
        setAdCooldownSeconds(res.data.cooldown_remaining || 60);
        if (res.data.user) updateUser(res.data.user);
        queryClient.invalidateQueries({ queryKey: ['ad-watch-status', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['referralMilestones', user?.id] });
        feedback.success(`Earned ${res.data.rewardCoins || 2} Reader Coins & contributed to milestone!`);
      } else if (activeAd.purpose === 'author_commission' && activeAd.commissionId) {
        const res = await http.post(`/referrals/author-commissions/${activeAd.commissionId}/watch-ad`, {
          ad_event_id: activeAd.adEventId,
        });
        queryClient.invalidateQueries({ queryKey: ['authorCommissions', user?.id] });
        feedback.success(res.data.message || 'Ad progress recorded for commission!');
      }
      setActiveAd(null);
    } catch (error) {
      feedback.error(getApiErrorMessage(error, 'Could not complete ad reward.'));
      setActiveAd(null);
    } finally {
      setCompletingAd(false);
    }
  };

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
  const commissions = commissionsData?.commissions || [];
  const commissionSummary = commissionsData?.summary;

  return (
    <div className="space-y-6 my-8">
      {/* HEADER */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Gift className="w-6 h-6 text-primary" />
          Referral Rewards & Milestone Program
        </h2>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Invite friends to earn up to 550 Reader Coins per active reader + dynamic 5% lifetime author commissions!
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
                onChange={(e) => setWelcomeCode(parseReferralInput(e.target.value))}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text');
                  const parsed = parseReferralInput(pasted);
                  if (parsed && parsed !== pasted) {
                    e.preventDefault();
                    setWelcomeCode(parsed);
                  }
                }}
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

      {/* SHAREABLE INVITE & STATS CARD */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Share Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-1">
              <Users className="w-5 h-5 text-primary" />
              Your Shareable Referral Link
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Share this link with fellow book lovers and writers to earn passive coins and PHP cash income.
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
            <span>Referral Code: <strong className="text-gray-900 dark:text-gray-100">{user?.username}</strong></span>
            <span>Total Referrals: <strong className="text-primary">{user?.referralCount || 0}</strong></span>
          </div>
        </div>

        {/* Quick Earnings Overview Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
                Earnings Summary
              </span>
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 mb-1">
              Referral & Author Earnings
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              All lifetime earnings generated from your invited readers and authors.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800">
                <span className="text-[11px] text-gray-500 block">PHP Cash Balance</span>
                <span className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">
                  ₱{Number(user?.balance || 0).toFixed(2)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800">
                <span className="text-[11px] text-gray-500 block">Commissions Claimed</span>
                <span className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  ₱{Number(commissionSummary?.total_claimed || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t border-gray-100 dark:border-slate-700 mt-3">
            <span>Ready to Claim: <strong className="text-amber-600 font-bold">₱{Number(commissionSummary?.total_ready_to_claim || 0).toFixed(2)}</strong></span>
            <span>Pending Ads: <strong className="text-gray-600 dark:text-gray-300 font-bold">₱{Number(commissionSummary?.total_pending || 0).toFixed(2)}</strong></span>
          </div>
        </div>
      </div>

      {/* 5% AUTHOR REFERRAL COMMISSION SECTION (TASK 6) */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-200 dark:border-slate-700 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                Lifetime Cash Perk
              </span>
            </div>
            <h3 className="font-bold text-base sm:text-lg text-gray-900 dark:text-gray-100 flex items-center gap-2 mt-1">
              <Award className="w-5 h-5 text-amber-500" />
              5% Author Referral Commission
            </h3>
            <p className="text-xs text-gray-500 max-w-2xl">
              When an author who signed up with your referral link withdraws their story earnings, you earn a <strong>5% cash commission</strong> directly credited to your <strong>PHP balance</strong>! Dynamic ads are required based on their withdrawal amount before claiming.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Total Claimed: ₱{Number(commissionSummary?.total_claimed || 0).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Dynamic Ad Tiers Scale Banner */}
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 text-[11px] text-amber-900 dark:text-amber-200 mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-medium">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Dynamic Ad Scale per Withdrawal:</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-amber-800 dark:text-amber-300">
            <span>≤₱10: <strong>1 ad</strong></span>
            <span>•</span>
            <span>₱10.01–₱25: <strong>2 ads</strong></span>
            <span>•</span>
            <span>₱25.01–₱50: <strong>3 ads</strong></span>
            <span>•</span>
            <span>₱50.01–₱100: <strong>4 ads</strong></span>
            <span>•</span>
            <span>&gt;₱100: <strong>5 ads</strong></span>
          </div>
        </div>

        {/* Commissions List */}
        {loadingCommissions ? (
          <div className="text-center py-6 text-xs text-gray-500">Loading commissions...</div>
        ) : commissions.length === 0 ? (
          <div className="text-center py-8 px-4 rounded-xl border border-dashed border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/30">
            <Award className="w-8 h-8 text-gray-400 mx-auto mb-2 opacity-50" />
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">No Author Commissions Yet</p>
            <p className="text-[11px] text-gray-500 max-w-md mx-auto mt-1">
              Invite authors to publish stories on MoneyPad. Whenever they withdraw story earnings, your 5% cash commissions will appear here!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {commissions.map((comm) => {
              const isReady = comm.status === 'ready_to_claim';
              const isClaimed = comm.status === 'claimed';
              const isPending = comm.status === 'pending';

              return (
                <div
                  key={comm.id}
                  className="p-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/40 dark:bg-slate-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors hover:border-gray-300 dark:hover:border-slate-600"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 overflow-hidden border border-primary/20">
                      {comm.author?.profileImageUrl ? (
                        <img src={comm.author.profileImageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (comm.author?.username || 'A')[0].toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                          @{comm.author?.username || 'author'}
                        </span>
                        {comm.author?.isVerified && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                        )}
                        <span className="text-[10px] text-gray-400">
                          withdrew ₱{Number(comm.withdrawal_amount).toFixed(2)}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                        <DollarSign className="w-3.5 h-3.5" />
                        ₱{Number(comm.commission_amount).toFixed(2)} PHP Cash Commission
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto shrink-0 justify-between sm:justify-end">
                    {/* Progress Bar for Ads */}
                    <div className="w-full sm:w-36">
                      <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                        <span>Ads Watched</span>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">
                          {comm.ads_watched} / {comm.required_ads}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (comm.ads_watched / Math.max(1, comm.required_ads)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="shrink-0 w-full sm:w-auto">
                      {isClaimed ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-gray-400 w-full sm:w-auto justify-center">
                          <Check className="w-3.5 h-3.5" /> Claimed to Balance
                        </span>
                      ) : isReady ? (
                        <button
                          type="button"
                          onClick={() => claimCommissionMutation.mutate(comm.id)}
                          disabled={claimCommissionMutation.isPending}
                          className="w-full sm:w-auto px-4 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {claimCommissionMutation.isPending ? (
                            <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          Claim ₱{Number(comm.commission_amount).toFixed(2)}
                        </button>
                      ) : isPending ? (
                        <button
                          type="button"
                          onClick={() => handleStartCommissionAd(comm.id)}
                          disabled={startingAd}
                          className="w-full sm:w-auto px-3.5 py-1.5 bg-amber-500 text-white rounded-xl text-xs font-bold hover:bg-amber-600 transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {startingAd ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Tv className="w-3.5 h-3.5" />}
                          Watch Ad ({comm.required_ads - comm.ads_watched} left)
                        </button>
                      ) : (
                        <span className="text-[10px] text-gray-400">Cancelled</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ACTIVITY MILESTONE REWARDS (TASK 4) */}
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

        {/* INTERACTIVE ACTION AREA: CONTRIBUTE & PROGRESS MILESTONES (TASK 4) */}
        <div className="mb-6 p-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-900/40">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                  Contribute to Milestones
                </span>
                {user?.referredBy ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                    <CheckCircle2 className="w-3 h-3" />
                    Supporting @{user.referredBy}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                    <Lock className="w-3 h-3" />
                    No Inviter Linked
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 mt-1 max-w-xl">
                {user?.referredBy
                  ? `Watching ads and reading chapters directly contributes to @${user.referredBy}'s milestone progress while earning you instant Reader Coins!`
                  : 'Link a referral username to unlock milestone ad watching and support your inviter as you read and watch ads.'}
              </p>
            </div>

            {/* Action Buttons / Link Form */}
            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
              {user?.referredBy ? (
                <>
                  <button
                    type="button"
                    onClick={handleStartMilestoneAd}
                    disabled={startingAd || adCooldown > 0}
                    className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-green-600 transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {startingAd ? (
                      <LoaderCircle className="w-4 h-4 animate-spin" />
                    ) : adCooldown > 0 ? (
                      <Clock className="w-4 h-4" />
                    ) : (
                      <Tv className="w-4 h-4" />
                    )}
                    {adCooldown > 0
                      ? `Cooldown (${adCooldown}s)`
                      : 'Watch Ad (+2 Coins & Support)'}
                  </button>

                  <Link
                    to="/explore"
                    className="px-3.5 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-slate-700 transition flex items-center gap-1.5"
                  >
                    <BookOpen className="w-4 h-4 text-primary" />
                    Read Stories (+1 Ch)
                  </Link>
                </>
              ) : (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (inlineInviterCode.trim()) {
                        linkInviterMutation.mutate(inlineInviterCode);
                      }
                    }}
                    className="flex gap-1.5"
                  >
                    <input
                      type="text"
                      placeholder="Inviter's username"
                      value={inlineInviterCode}
                      onChange={(e) => setInlineInviterCode(parseReferralInput(e.target.value))}
                      onPaste={(e) => {
                        const pasted = e.clipboardData.getData('text');
                        const parsed = parseReferralInput(pasted);
                        if (parsed && parsed !== pasted) {
                          e.preventDefault();
                          setInlineInviterCode(parsed);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 text-xs border border-gray-200 dark:border-slate-700 placeholder:text-gray-400 focus:outline-none w-36 sm:w-44"
                    />
                    <button
                      type="submit"
                      disabled={!inlineInviterCode.trim() || linkInviterMutation.isPending}
                      className="px-3 py-1.5 bg-gray-900 text-white dark:bg-slate-700 rounded-lg text-xs font-bold hover:bg-black transition disabled:opacity-50 cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      {linkInviterMutation.isPending ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : 'Link'}
                    </button>
                  </form>

                  <button
                    type="button"
                    disabled
                    title="Link a referral username first to unlock ad watching for milestones"
                    className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-400 rounded-xl text-xs font-medium border border-gray-200 dark:border-slate-700 flex items-center gap-1.5 cursor-not-allowed opacity-75"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Watch Ad (Locked)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MILESTONE TIERS TABLE */}
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
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-gray-400">
                          Claimed <Check className="w-3 h-3" />
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

      {/* REWARDED AD MODAL (for milestone ads or author commission ads) */}
      {activeAd && (
        <MockRewardedAd
          onComplete={handleAdComplete}
          onCancel={() => {
            if (!completingAd) setActiveAd(null);
          }}
          isCompleting={completingAd}
        />
      )}
    </div>
  );
};

export default ReferralProgramSection;
