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
    <section className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm sm:p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Reading earnings</h2>
          <p className="mt-1 text-sm text-slate-500">Each minute remains available for 24 hours after it is earned.</p>
        </div>
        <div className="inline-flex rounded-lg bg-slate-200 p-1" aria-label="Reading earnings views">
          {(['income', 'claimed'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold capitalize transition ${
                activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
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
          <div className="flex flex-col gap-4 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-600 p-5 text-white sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-100">Available to claim</p>
              <p className="mt-1 text-3xl font-bold">{formatCoins(incomeQuery.data?.pending_total ?? 0)}</p>
              <p className="text-xs text-emerald-100">{formatPesoFromCoins(incomeQuery.data?.pending_total ?? 0)} cash value</p>
              {incomeQuery.data?.nearest_expiration && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-100">
                  <Clock3 className="h-4 w-4" />
                  Earliest reward expires in {formatTimeRemaining(incomeQuery.data.nearest_expiration, currentTime)}
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={!incomeQuery.data?.data.length || createClaim.isPending}
              onClick={() => createClaim.mutate()}
              className="inline-flex min-w-40 items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-bold text-emerald-800 shadow-sm hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createClaim.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
              Claim all available
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
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <Coins className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-2 text-sm text-slate-500">Complete a full minute of active reading to earn income.</p>
            </div>
          )}

          {Object.entries(groupedRewards).map(([date, rewards]) => (
            <div key={date} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{date}</p>
              {rewards.map((reward) => (
                <article key={reward.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
                  <div>
                    <p className="font-medium text-slate-900">{reward.story?.title ?? 'Reading reward'}</p>
                    <p className="text-xs text-slate-500">
                      {reward.story_part?.title ? `${reward.story_part.title} · ` : ''}
                      {new Date(reward.earned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-emerald-700">+{formatCoins(reward.amount)}</p>
                    <p className="text-xs text-slate-500">{formatPesoFromCoins(reward.amount)}</p>
                    <p className="text-xs text-amber-700">Expires in {formatTimeRemaining(reward.expires_at, currentTime)}</p>
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
