import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import http from '../api/http';
import { useAuth } from '../auth/AuthProvider';
import type { CreateClaimResponse } from '../types/earnings';
import { MockRewardedAd } from './MockRewardedAd';
import { RewardAdPromptModal } from './RewardAdPromptModal';
import { formatCoins, formatPesoFromCoins } from '../utils/money';
import { useFeedback } from './feedback/feedback';
import { getApiErrorMessage } from '../utils/apiError';

interface IncomeClaimModalProps {
  claim: CreateClaimResponse;
  onClose: () => void;
}

export function IncomeClaimModal({ claim, onClose }: IncomeClaimModalProps) {
  const { updateUser } = useAuth();
  const queryClient = useQueryClient();
  const feedback = useFeedback();
  const [showAd, setShowAd] = useState(false);

  const completeMutation = useMutation({
    mutationFn: async () => (await http.post(`/earnings/claims/${claim.claim.id}/complete`, {
      mock_ad_token: claim.mock_ad_token,
    })).data,
    onSuccess: async (data) => {
      updateUser(data.user);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['earnings'] }),
        queryClient.invalidateQueries({ queryKey: ['withdrawals'] }),
      ]);
      feedback.success('Reading income credited.');
      onClose();
    },
    onError: (error) => feedback.error(getApiErrorMessage(error, 'The ad completion could not be verified.')),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => http.delete(`/earnings/claims/${claim.claim.id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['earnings', 'income'] });
      onClose();
    },
    onError: (error) => feedback.error(getApiErrorMessage(error, 'The claim could not be cancelled.')),
  });

  const cancelClaim = () => {
    if (!cancelMutation.isPending && !completeMutation.isPending) cancelMutation.mutate();
  };

  if (showAd) {
    return (
      <MockRewardedAd
        onComplete={() => completeMutation.mutate()}
        onCancel={cancelClaim}
        isCompleting={completeMutation.isPending || cancelMutation.isPending}
        completingLabel="Crediting income..."
        claimLabel="Claim reading income"
      />
    );
  }

  return (
    <RewardAdPromptModal
      isOpen={!showAd}
      onClose={cancelClaim}
      onWatchAd={() => setShowAd(true)}
      title="Claim Your Reading Reward!"
      rewardTitle={`${formatCoins(claim.claim.amount)} Reader Coins`}
      rewardDescription={`Earn ${formatCoins(claim.claim.amount)} coins (${formatPesoFromCoins(claim.claim.amount)}) from reading!`}
      confirmLabel="Watch Ad to Claim"
      isPending={cancelMutation.isPending || completeMutation.isPending}
    />
  );
}
