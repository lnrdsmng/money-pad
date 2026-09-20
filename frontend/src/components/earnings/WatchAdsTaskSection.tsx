import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tv, Sparkles, Clock, LoaderCircle } from 'lucide-react';
import http from '../../api/http';
import { useAuth } from '../../auth/AuthProvider';
import { MockRewardedAd } from '../MockRewardedAd';
import { RewardAdPromptModal } from '../RewardAdPromptModal';
import { useFeedback } from '../feedback/feedback';
import { getApiErrorMessage } from '../../utils/apiError';

interface AdWatchStatus {
  reward_coins: number;
  cooldown_seconds: number;
  cooldown_remaining: number;
  can_watch: boolean;
  available: boolean;
  cooldown_ends_at: number | null;
}

export function WatchAdsTaskSection() {
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const feedback = useFeedback();

  const [adEventId, setAdEventId] = useState<string | null>(null);
  const [startingAd, setStartingAd] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showAd, setShowAd] = useState(false);
  const [cooldownEndsAt, setCooldownEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const { data: status, isLoading } = useQuery<AdWatchStatus>({
    queryKey: ['ad-watch-status', user?.id],
    queryFn: async () => (await http.get('/transactions/ad-watch/status')).data,
    enabled: !!user,
  });

  const effectiveCooldownEndsAt = cooldownEndsAt ?? status?.cooldown_ends_at ?? null;
  const cooldown = effectiveCooldownEndsAt === null
    ? 0
    : Math.max(0, Math.ceil((effectiveCooldownEndsAt - now) / 1000));

  useEffect(() => {
    if (effectiveCooldownEndsAt === null) return;
    const interval = window.setInterval(() => {
      const currentTime = Date.now();
      setNow(currentTime);
      if (currentTime >= effectiveCooldownEndsAt) {
        setCooldownEndsAt(null);
        void queryClient.invalidateQueries({ queryKey: ['ad-watch-status', user?.id] });
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [effectiveCooldownEndsAt, queryClient, user?.id]);

  useEffect(() => {
    const synchronize = () => void queryClient.invalidateQueries({ queryKey: ['ad-watch-status', user?.id] });
    window.addEventListener('focus', synchronize);
    document.addEventListener('visibilitychange', synchronize);
    return () => {
      window.removeEventListener('focus', synchronize);
      document.removeEventListener('visibilitychange', synchronize);
    };
  }, [queryClient, user?.id]);

  const watchAdMutation = useMutation({
    mutationFn: async () => {
      if (!adEventId) throw new Error('Start an ad before claiming.');
      await http.post(`/rewarded-ads/${adEventId}/mock-verify`);
      const res = await http.post('/transactions/ad-watch', { ad_event_id: adEventId });
      return res.data;
    },
    onSuccess: (data) => {
      setShowAd(false);
      const remaining = Number(data.cooldown_remaining ?? 0);
      setCooldownEndsAt(remaining > 0 ? Date.now() + remaining * 1000 : null);
      setNow(Date.now());
      if (data.user) {
        updateUser(data.user);
      }
      queryClient.invalidateQueries({ queryKey: ['ad-watch-status', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['withdrawals', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['referralMilestones', user?.id] });
      feedback.success(`You earned ${data.rewardCoins || 2} Reader Coins!`);
    },
    onError: (error) => {
      setShowAd(false);
      feedback.error(getApiErrorMessage(error, 'Could not complete ad task. Please try again.'));
      queryClient.invalidateQueries({ queryKey: ['ad-watch-status', user?.id] });
    },
  });

  const startAd = async () => {
    setStartingAd(true);
    try {
      const response = await http.post<{ id: string }>('/rewarded-ads', { purpose: 'coins' });
      setAdEventId(response.data.id);
      setShowAd(true);
    } catch (error) { feedback.error(getApiErrorMessage(error, 'Rewarded ads are currently unavailable.')); }
    finally { setStartingAd(false); }
  };

  return (
    <section className="mb-6 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start space-x-3 sm:space-x-4">
          <div className="rounded-xl bg-primary/10 text-primary p-2.5 sm:p-3 shadow-xs shrink-0 mt-0.5 sm:mt-0">
            <Tv className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">Watch Ads Task</h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="w-3 h-3 mr-1" />
                +2 Coins / Ad
              </span>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Watch a quick rewarded ad to earn 2 Reader Coins directly to your balance. Cooldown: 1 minute between ads.
            </p>
          </div>
        </div>

        <div className="w-full sm:w-auto shrink-0">
          {cooldown > 0 ? (
            <button
              type="button"
              disabled
              className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-gray-100 dark:bg-slate-800 px-5 py-2.5 text-xs sm:text-sm font-semibold text-gray-500 cursor-not-allowed opacity-90 transition-all"
            >
              <Clock className="h-4 w-4 text-gray-400 animate-pulse" />
              <span>Cooldown: {cooldown}s</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowPrompt(true)}
              disabled={isLoading || startingAd || watchAdMutation.isPending || !status?.can_watch}
              className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-primary-hover active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
            >
              {watchAdMutation.isPending ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  <span>Recording reward...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>{!status?.available ? 'Rewarded ads unavailable' : 'Watch Ad (+2 Coins)'}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <RewardAdPromptModal
        isOpen={showPrompt}
        onClose={() => setShowPrompt(false)}
        onWatchAd={() => {
          setShowPrompt(false);
          void startAd();
        }}
        title="Watch an Ad and Claim 2 Coins!"
        rewardTitle="+2 Reader Coins"
        rewardDescription="Earn 2 Reader Coins added straight to your balance!"
        confirmLabel="Watch Ad to Claim"
        isPending={startingAd}
      />

      {showAd && (
        <MockRewardedAd
          onComplete={() => watchAdMutation.mutate()}
          onCancel={() => setShowAd(false)}
          isCompleting={watchAdMutation.isPending}
          completingLabel="Crediting coins..."
          claimLabel="Claim 2 coins"
        />
      )}
    </section>
  );
}
