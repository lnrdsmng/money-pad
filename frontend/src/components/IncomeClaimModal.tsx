import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, X } from 'lucide-react';
import { useState } from 'react';
import http from '../api/http';
import { useAuth } from '../auth/AuthProvider';
import type { CreateClaimResponse } from '../types/earnings';
import { MockRewardedAd } from './MockRewardedAd';

interface IncomeClaimModalProps {
  claim: CreateClaimResponse;
  onClose: () => void;
}

export function IncomeClaimModal({ claim, onClose }: IncomeClaimModalProps) {
  const { updateUser } = useAuth();
  const queryClient = useQueryClient();
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
      onClose();
    },
  });

  const cancelClaim = async () => {
    try {
      await http.delete(`/earnings/claims/${claim.claim.id}`);
      await queryClient.invalidateQueries({ queryKey: ['earnings', 'income'] });
    } finally {
      onClose();
    }
  };

  if (showAd) {
    return <MockRewardedAd onComplete={() => completeMutation.mutate()} onCancel={cancelClaim} isCompleting={completeMutation.isPending} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Claim all available income</h2>
            <p className="mt-1 text-sm text-slate-500">
              {claim.claim.reward_count} reward{claim.claim.reward_count === 1 ? '' : 's'} totaling ₱{Number(claim.claim.amount).toFixed(3)}
            </p>
          </div>
          <button type="button" onClick={cancelClaim} className="rounded-full p-2 text-slate-400 hover:bg-slate-100" aria-label="Cancel claim">
            <X className="h-5 w-5" />
          </button>
        </div>

        {claim.claim.ad_provider !== 'mock' && (
          <div className="mt-5 flex gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            <AlertCircle className="h-5 w-5 shrink-0" />
            The production rewarded-ad provider has not been configured yet.
          </div>
        )}
        {completeMutation.isError && (
          <div className="mt-5 flex gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-5 w-5 shrink-0" />
            The ad completion could not be verified. Please try again.
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={cancelClaim} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Not now</button>
          <button
            type="button"
            disabled={claim.claim.ad_provider !== 'mock'}
            onClick={() => setShowAd(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Watch ad and claim
          </button>
        </div>
      </div>
    </div>
  );
}
