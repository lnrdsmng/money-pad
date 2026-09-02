import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock3 } from 'lucide-react';
import { useState } from 'react';
import http from '../api/http';
import type { PaginatedClaims } from '../types/earnings';
import { formatCoins, formatPesoFromCoins } from '../utils/money';

export function ClaimedEarningsSection() {
  const [range, setRange] = useState<'7d' | '30d'>('7d');
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useQuery<PaginatedClaims>({
    queryKey: ['earnings', 'claimed', range, page],
    queryFn: async () => (await http.get('/earnings/claimed', { params: { range, page } })).data,
  });

  const groupedClaims = (data?.data ?? []).reduce<Record<string, PaginatedClaims['data']>>((groups, claim) => {
    const key = new Date(claim.claimed_at ?? '').toLocaleDateString(undefined, {
      month: 'long', day: 'numeric', year: 'numeric',
    });
    groups[key] = [...(groups[key] ?? []), claim];
    return groups;
  }, {});

  return (
    <section aria-labelledby="claimed-income-heading" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 id="claimed-income-heading" className="text-base sm:text-lg font-semibold text-slate-900">Claimed income</h3>
          <p className="text-xs sm:text-sm text-slate-500">View up to one month of credited reading income.</p>
        </div>
        <div className="inline-flex w-fit rounded-lg bg-slate-200 p-1" aria-label="Claim history range">
          {(['7d', '30d'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setRange(option);
                setPage(1);
              }}
              className={`rounded-md px-3 py-1.5 text-xs sm:text-sm font-medium transition ${range === option ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              {option === '7d' ? '7 days' : '1 month'}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="py-8 text-center text-sm text-slate-500">Loading claimed income…</p>}
      {isError && <p className="py-8 text-center text-sm text-red-600">Claimed income could not be loaded.</p>}
      {!isLoading && !isError && Object.keys(groupedClaims).length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 sm:p-8 text-center">
          <Clock3 className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-2 text-xs sm:text-sm text-slate-500">No claims in this period.</p>
        </div>
      )}

      {Object.entries(groupedClaims).map(([date, claims]) => (
        <div key={date} className="space-y-2">
          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-slate-500">{date}</p>
          {claims.map((claim) => (
            <article key={claim.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <span className="rounded-full bg-emerald-100 p-1.5 sm:p-2 text-emerald-700 shrink-0"><CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" /></span>
                <div className="min-w-0">
                  <p className="font-medium text-xs sm:text-sm text-slate-900 truncate">{claim.reward_count} minute{claim.reward_count === 1 ? '' : 's'} claimed</p>
                  <p className="text-[11px] sm:text-xs text-slate-500">
                    {new Date(claim.claimed_at ?? '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <div className="flex sm:flex-col justify-between sm:justify-start sm:text-right border-t sm:border-t-0 border-slate-100 pt-1.5 sm:pt-0 shrink-0">
                <p className="font-semibold text-xs sm:text-sm text-emerald-700">+{formatCoins(claim.amount)}</p>
                <p className="text-[10px] sm:text-xs text-slate-500">{formatPesoFromCoins(claim.amount)}</p>
              </div>
            </article>
          ))}
        </div>
      ))}

      {(data?.last_page ?? 1) > 1 && (
        <div className="flex items-center justify-end gap-3 pt-2">
          <button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50">Previous</button>
          <span className="text-sm text-slate-500">Page {data?.current_page} of {data?.last_page}</span>
          <button type="button" disabled={page === data?.last_page} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50">Next</button>
        </div>
      )}
    </section>
  );
}
