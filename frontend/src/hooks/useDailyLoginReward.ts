import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import http from '../api/http';
import { useAuth } from '../auth/AuthProvider';
import { useFeedback } from '../components/feedback/feedback';
import { getApiErrorMessage } from '../utils/apiError';

export interface RewardDay {
  day: number;
  date: string;
  amount: string | null;
  status: 'claimed' | 'missed' | 'available' | 'upcoming';
}

export interface RewardStatus {
  eligible: boolean;
  days: RewardDay[];
  server_date: string;
}

export function useDailyLoginReward() {
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const feedback = useFeedback();

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
      const coins = data.claim?.amount || data.claimed_amount || 'daily';
      feedback.success(`Claimed ${coins} coins from daily login reward!`);
    },
    onError: (error) => {
      feedback.error(getApiErrorMessage(error, 'Today’s reward could not be claimed.'));
    },
  });

  const availableDay = rewardQuery.data?.days.find((day) => day.status === 'available');
  const claimedToday = rewardQuery.data?.days.some(
    (day) => day.date === rewardQuery.data?.server_date && day.status === 'claimed',
  );
  const hasAvailableReward = Boolean(rewardQuery.data?.eligible && availableDay);

  return {
    rewardQuery,
    claimMutation,
    availableDay,
    claimedToday,
    hasAvailableReward,
    eligible: Boolean(rewardQuery.data?.eligible),
    serverDate: rewardQuery.data?.server_date,
    days: rewardQuery.data?.days || [],
  };
}
