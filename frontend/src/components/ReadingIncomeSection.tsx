import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Clock3, Coins, LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import http from '../api/http';
import { useAuth } from '../auth/AuthProvider';
import type { CreateClaimResponse, ReadingIncomeResponse } from '../types/earnings';
import { ClaimedEarningsSection } from './ClaimedEarningsSection';
import { IncomeClaimModal } from './IncomeClaimModal';
import { formatCoins, formatPesoFromCoins } from '../utils/money';

function formatTimeRemaining(expiresAt: string, now: number) {
  const seconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return `${hours}h ${minutes}m`;
}

export function ReadingIncomeSection() {
  const { updateUser } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'income' | 'claimed'>('income');
  const [claim, setClaim] = useState<CreateClaimResponse | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const incomeQuery = useQuery<ReadingIncomeResponse>({
    queryKey: ['earnings', 'income'],
    queryFn: async () => (await http.get('/earnings/income')).data,
    enabled: activeTab === 'income',
    refetchInterval: 60_000,
  });

  const createClaim = useMutation<CreateClaimResponse>({
    mutationFn: async () => (await http.post('/earnings/claims')).data,
    onSuccess: async (result) => {
      if (result.completed) {
        if (result.user) updateUser(result.user);
        await queryClient.invalidateQueries({ queryKey: ['earnings'] });
        return;
      }

      setClaim(result);
    },
  });

  const groupedRewards = useMemo(() => {
    return (incomeQuery.data?.data ?? []).reduce<Record<string, ReadingIncomeResponse['data']>>((groups, reward) => {
      const key = new Date(reward.earned_at).toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      groups[key] = [...(groups[key] ?? []), reward];
      return groups;
    }, {});
  }, [incomeQuery.data]);
  const currentTime = now || (incomeQuery.data?.server_time ? new Date(incomeQuery.data.server_time).getTime() : 0);

  return (
    <section className="mb-6 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-xs">
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">Reading Earnings & Rewards</h2>
          <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">Earn coins by reading stories. Each minute remains available for 24 hours.</p>
        </div>
        <div className="inline-flex rounded-xl bg-gray-100 dark:bg-slate-800 p-1 shrink-0" aria-label="Reading earnings views">
          {(['income', 'claimed'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-semibold capitalize transition cursor-pointer ${
                activeTab === tab ? 'bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 shadow-xs' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'claimed' ? (
        <ClaimedEarningsSection />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-primary to-[#3d934b] p-5 sm:p-6 text-white sm:flex-row sm:items-center sm:justify-between shadow-xs">
            <div>
              <p className="text-xs sm:text-sm font-medium text-green-100">Available to Claim</p>
              <p className="mt-1 text-2xl sm:text-4xl font-bold">{formatCoins(incomeQuery.data?.pending_total ?? 0)}</p>
              <p className="text-xs text-green-100 mt-0.5">{formatPesoFromCoins(incomeQuery.data?.pending_total ?? 0)} cash value</p>
              {incomeQuery.data?.nearest_expiration && (
                <p className="mt-2.5 flex items-center gap-1.5 text-[11px] sm:text-xs text-green-100 bg-white/15 px-2.5 py-1 rounded-lg w-fit">
                  <Clock3 className="h-3.5 w-3.5 shrink-0" />
                  Earliest reward expires in {formatTimeRemaining(incomeQuery.data.nearest_expiration, currentTime)}
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={!incomeQuery.data?.data.length || createClaim.isPending}
              onClick={() => createClaim.mutate()}
              className="inline-flex w-full sm:w-auto sm:min-w-44 items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-accent-hover active:scale-98 transition disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              {createClaim.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
              Claim All Available
            </button>
          </div>

          {createClaim.isError && (
            <div className="flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              Your available income could not be claimed. Refresh and try again.
            </div>
          )}

          {incomeQuery.isLoading && <p className="py-8 text-center text-sm text-slate-500">Loading income…</p>}
          {incomeQuery.isError && <p className="py-8 text-center text-sm text-red-600">Income could not be loaded.</p>}
          {!incomeQuery.isLoading && !incomeQuery.isError && Object.keys(groupedRewards).length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 sm:p-8 text-center">
              <Coins className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-2 text-xs sm:text-sm text-slate-500">Complete a full minute of active reading to earn income.</p>
            </div>
          )}

          {Object.entries(groupedRewards).map(([date, rewards]) => (
            <div key={date} className="space-y-2">
              <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-slate-500">{date}</p>
              {rewards.map((reward) => (
                <article key={reward.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{reward.story?.title ?? 'Reading reward'}</p>
                    <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                      {reward.story_part?.title ? `${reward.story_part.title} · ` : ''}
                      {new Date(reward.earned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex sm:flex-col justify-between sm:justify-start sm:text-right border-t sm:border-t-0 border-slate-100 pt-1.5 sm:pt-0 shrink-0">
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-emerald-700">+{formatCoins(reward.amount)}</p>
                      <p className="text-[10px] sm:text-xs text-slate-500">{formatPesoFromCoins(reward.amount)}</p>
                    </div>
                    <p className="text-[10px] sm:text-xs text-amber-700">Expires in {formatTimeRemaining(reward.expires_at, currentTime)}</p>
                  </div>
                </article>
              ))}
            </div>
          ))}
        </div>
      )}

      {claim && <IncomeClaimModal claim={claim} onClose={() => setClaim(null)} />}
    </section>
  );
}
