import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tv, Sparkles, Clock, LoaderCircle } from 'lucide-react';
import http from '../../api/http';
import { useAuth } from '../../auth/AuthProvider';
import { MockRewardedAd } from '../MockRewardedAd';
import { useFeedback } from '../feedback/feedback';
import { getApiErrorMessage } from '../../utils/apiError';

interface AdWatchStatus {
  reward_coins: number;
  cooldown_seconds: number;
  cooldown_remaining: number;
  can_watch: boolean;
}

export function WatchAdsTaskSection() {
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const feedback = useFeedback();

  const [showAd, setShowAd] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState<number | null>(null);

  const { data: status, isLoading } = useQuery<AdWatchStatus>({
    queryKey: ['ad-watch-status'],
    queryFn: async () => (await http.get('/transactions/ad-watch/status')).data,
    enabled: !!user,
  });

  const cooldown = cooldownSeconds ?? (status?.cooldown_remaining ?? 0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => {
        const current = (prev ?? (status?.cooldown_remaining ?? 0)) - 1;
        if (current <= 0) {
          clearInterval(interval);
          queryClient.invalidateQueries({ queryKey: ['ad-watch-status'] });
          return 0;
        }
        return current;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown, queryClient, status?.cooldown_remaining]);

  const watchAdMutation = useMutation({
    mutationFn: async () => {
      const res = await http.post('/transactions/ad-watch', {
        id: `ad_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        userId: user?.id,
        watchedAt: Date.now(),
      });
      return res.data;
    },
    onSuccess: (data) => {
      setShowAd(false);
      setCooldownSeconds(data.cooldown_remaining || 60);
      if (data.user) {
        updateUser(data.user);
      }
      queryClient.invalidateQueries({ queryKey: ['ad-watch-status'] });
      queryClient.invalidateQueries({ queryKey: ['withdrawals', user?.id] });
      feedback.success(`You earned ${data.rewardCoins || 2} Reader Coins!`);
    },
    onError: (error) => {
      setShowAd(false);
      feedback.error(getApiErrorMessage(error, 'Could not complete ad task. Please try again.'));
      queryClient.invalidateQueries({ queryKey: ['ad-watch-status'] });
    },
  });

  return (
    <section className="mb-6 sm:mb-8 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-purple-50/70 p-4 sm:p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start space-x-3 sm:space-x-4">
          <div className="rounded-xl bg-blue-600 p-2.5 sm:p-3 text-white shadow-xs shrink-0 mt-0.5 sm:mt-0">
            <Tv className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">Watch Ads Task</h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                <Sparkles className="w-3 h-3 mr-1" />
                +2 Coins / Ad
              </span>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-slate-600">
              Watch a quick rewarded ad to earn 2 Reader Coins directly to your balance. Cooldown: 1 minute between ads.
            </p>
          </div>
        </div>

        <div className="w-full sm:w-auto shrink-0">
          {cooldown > 0 ? (
            <button
              type="button"
              disabled
              className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-slate-200 px-5 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 cursor-not-allowed opacity-90 transition-all"
            >
              <Clock className="h-4 w-4 text-slate-500 animate-pulse" />
              <span>Cooldown: {cooldown}s</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowAd(true)}
              disabled={isLoading || watchAdMutation.isPending}
              className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-98 transition-all disabled:opacity-50"
            >
              {watchAdMutation.isPending ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  <span>Recording reward...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Watch Ad (+2 Coins)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {showAd && (
        <MockRewardedAd
          onComplete={() => watchAdMutation.mutate()}
          onCancel={() => setShowAd(false)}
          isCompleting={watchAdMutation.isPending}
        />
      )}
    </section>
  );
}
