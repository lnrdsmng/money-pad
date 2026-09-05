import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, X } from 'lucide-react';
import { useState } from 'react';
import http from '../api/http';
import { useAuth } from '../auth/AuthProvider';
import type { CreateClaimResponse } from '../types/earnings';
import { MockRewardedAd } from './MockRewardedAd';
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
    return <MockRewardedAd onComplete={() => completeMutation.mutate()} onCancel={cancelClaim} isCompleting={completeMutation.isPending || cancelMutation.isPending} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-xl border border-transparent dark:border-slate-800">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">Claim all available income</h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {claim.claim.reward_count} reward{claim.claim.reward_count === 1 ? '' : 's'} totaling {formatCoins(claim.claim.amount)} ({formatPesoFromCoins(claim.claim.amount)})
            </p>
          </div>
          <button type="button" onClick={cancelClaim} disabled={cancelMutation.isPending} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 disabled:opacity-50 shrink-0 cursor-pointer" aria-label="Cancel claim">
            <X className="h-5 w-5" />
          </button>
        </div>

        {claim.claim.ad_provider !== 'mock' && (
          <div className="mt-4 flex gap-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-transparent dark:border-amber-900/50 p-3 text-xs sm:text-sm text-amber-800 dark:text-amber-200">
            <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
            The production rewarded-ad provider has not been configured yet.
          </div>
        )}
        {completeMutation.isError && (
          <div className="mt-4 flex gap-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-transparent dark:border-red-900/50 p-3 text-xs sm:text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
            The ad completion could not be verified. Please try again.
          </div>
        )}
        {cancelMutation.isError && (
          <div role="alert" className="mt-4 flex gap-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-transparent dark:border-red-900/50 p-3 text-xs sm:text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
            The claim could not be cancelled. Please try again.
          </div>
        )}

        <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
          <button type="button" onClick={cancelClaim} disabled={cancelMutation.isPending} aria-busy={cancelMutation.isPending} className="w-full sm:w-auto rounded-lg px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 text-center order-2 sm:order-1 cursor-pointer">
            {cancelMutation.isPending ? 'Cancelling...' : 'Not now'}
          </button>
          <button
            type="button"
            disabled={claim.claim.ad_provider !== 'mock' || cancelMutation.isPending}
            onClick={() => setShowAd(true)}
            className="w-full sm:w-auto rounded-lg bg-primary px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 text-center order-1 sm:order-2 cursor-pointer"
          >
            Watch ad and claim
          </button>
        </div>
      </div>
    </div>
  );
}
