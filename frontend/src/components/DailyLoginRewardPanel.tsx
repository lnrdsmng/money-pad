import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, Check, LoaderCircle, LockKeyhole } from 'lucide-react';
import http from '../api/http';
import { useAuth } from '../auth/AuthProvider';
import { formatPesoFromCoins } from '../utils/money';

interface RewardDay {
  day: number;
  date: string;
  amount: string;
  status: 'claimed' | 'missed' | 'available' | 'upcoming';
}

interface RewardStatus {
  eligible: boolean;
  days: RewardDay[];
  server_date: string;
}

export function DailyLoginRewardPanel() {
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const rewardQuery = useQuery<RewardStatus>({
    queryKey: ['daily-login-reward', user?.id],
    queryFn: async () => (await http.get('/daily-login-reward')).data,
    enabled: Boolean(user && user.role !== 'admin'),
  });
  const claimMutation = useMutation({
    mutationFn: async () => (await http.post('/daily-login-reward/claim')).data,
    onSuccess: async (data) => {
      updateUser(data.user);
      await queryClient.invalidateQueries({ queryKey: ['daily-login-reward', user?.id] });
    },
  });

  if (!rewardQuery.data?.eligible || !rewardQuery.data.days.some((day) => ['available', 'upcoming'].includes(day.status))) return null;

  const availableDay = rewardQuery.data.days.find((day) => day.status === 'available');
  const claimedToday = rewardQuery.data.days.some(
    (day) => day.date === rewardQuery.data?.server_date && day.status === 'claimed',
  );

  return (
    <section className="mx-auto mt-4 w-full max-w-7xl rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-3.5 sm:p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm sm:text-base font-bold text-amber-950"><CalendarCheck className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />New-account daily reward</h2>
          <p className="mt-1 text-xs sm:text-sm text-amber-800">Claim today in Philippine time. Missed days expire and cannot be recovered.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {rewardQuery.data.days.map((day) => (
            <div key={day.day} title={`${day.date}: ${day.status}`} className={`min-w-14 sm:min-w-16 flex-1 sm:flex-none rounded-lg border p-1.5 sm:p-2 text-center text-xs ${day.status === 'available' ? 'border-amber-500 bg-white ring-2 ring-amber-200' : day.status === 'claimed' ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white/60 text-slate-500'}`}>
              <p className="font-semibold text-[11px] sm:text-xs">Day {day.day}</p>
              <p className="mt-0.5 sm:mt-1 font-bold text-[11px] sm:text-xs">{Number(day.amount)} coins</p>
              {day.status === 'claimed' && <Check className="mx-auto mt-1 h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600" />}
              {day.status === 'missed' && <span className="mt-1 block text-[10px] sm:text-xs">Missed</span>}
              {day.status === 'upcoming' && <LockKeyhole className="mx-auto mt-1 h-3 w-3 sm:h-3.5 sm:w-3.5" />}
            </div>
          ))}
        </div>
        {availableDay && (
          <button type="button" disabled={claimMutation.isPending} onClick={() => claimMutation.mutate()} className="inline-flex w-full sm:w-auto shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-60">
            {claimMutation.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}Claim {availableDay.amount} coins ({formatPesoFromCoins(availableDay.amount)})
          </button>
        )}
        {claimedToday && <p className="w-full sm:w-auto shrink-0 rounded-lg bg-emerald-100 px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-emerald-800 text-center">Today's reward claimed</p>}
      </div>
      {claimMutation.isError && <p className="mt-3 text-sm text-red-700">Today's reward could not be claimed. Refresh and try again.</p>}
    </section>
  );
}
