import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import http from '../api/http';
import { formatCoins } from '../utils/money';
import type { Offerwall } from '../types/offerwalls';
import { LoadMoreButton } from '../components/common/LoadMoreButton';

const tabs = ['new', 'started', 'completed'] as const;

export default function OfferwallsPage() {
  const [tab, setTab] = useState<(typeof tabs)[number]>('new');
  const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery<{ data: Offerwall[]; current_page: number; last_page: number }>({
    queryKey: ['offerwalls', tab],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => (await http.get('/offerwalls', { params: { page: pageParam, category: tab } })).data,
    getNextPageParam: (page) => page.current_page < page.last_page ? page.current_page + 1 : undefined,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });
  const offers = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-3 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Offerwall</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Complete stages and earn reader coins after approval.</p>
      </div>
      <div role="tablist" aria-label="Offerwall status" className="flex gap-2 border-b border-gray-200 dark:border-slate-700">
        {tabs.map((item) => (
          <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)}
            className={`px-4 py-2 capitalize ${tab === item ? 'border-b-2 border-primary font-semibold text-primary' : 'text-gray-600 dark:text-gray-300'}`}>
            {item}
          </button>
        ))}
      </div>
      {isLoading && <p role="status">Loading offerwalls...</p>}
      {isError && <p role="alert" className="text-red-600">Offerwalls could not be loaded.</p>}
      {!isLoading && !isError && offers.length === 0 && <p className="rounded-xl bg-white p-6 text-gray-600 dark:bg-slate-900 dark:text-gray-300">No offerwalls in this tab.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {offers.map((offer) => (
          <Link key={offer.id} to={`/offerwalls/${offer.id}`}
            className="flex min-w-0 gap-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition hover:border-primary dark:border-slate-700 dark:bg-slate-900">
            <img src={offer.image_url} alt="" className="aspect-square h-24 w-24 shrink-0 rounded-lg object-cover sm:h-28 sm:w-28" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-semibold text-gray-900 dark:text-white">{offer.name}</h2>
              <p className="text-sm text-primary">Earn {formatCoins(offer.total_coins)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{offer.completed_stages}/{offer.stage_count} stages completed</p>
              {tab !== 'new' && (
                <div className="mt-3 space-y-1">
                  <progress value={offer.completed_stages} max={offer.stage_count} aria-label={`${offer.name} progress`} className="h-2 w-full accent-green-600" />
                  {tab === 'completed'
                    ? <p className="text-xs font-medium text-primary">Completed · {formatCoins(offer.earned_coins)}</p>
                    : <><p className="text-xs text-gray-600 dark:text-gray-300">{formatCoins(offer.earned_coins)} of {formatCoins(offer.total_coins)} earned</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300">Next step: {offer.next_step}</p></>}
                </div>
              )}
            </div>
            <span className="self-center rounded-full bg-primary p-2 text-white" aria-hidden="true"><ChevronRight size={18} /></span>
          </Link>
        ))}
      </div>
      <LoadMoreButton hasNextPage={Boolean(hasNextPage)} isFetchingNextPage={isFetchingNextPage} fetchNextPage={fetchNextPage} isError={isError} />
    </main>
  );
}
