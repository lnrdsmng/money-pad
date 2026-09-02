import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import http from '../api/http';
import { X, Play, FastForward, CheckCircle, LoaderCircle, Sparkles } from 'lucide-react';
import { MockRewardedAd } from './MockRewardedAd';
import { useFeedback } from './feedback/feedback';
import { getApiErrorMessage } from '../utils/apiError';
import type { WithdrawalRequest } from '../types/withdrawals';

export const WithdrawalFlowModal = ({ requestId, onClose }: { requestId: string; onClose: () => void }) => {
  const [showAd, setShowAd] = useState(false);
  const feedback = useFeedback();

  const { data: req, error: requestError, isError: isRequestError, refetch } = useQuery<WithdrawalRequest>({
    queryKey: ['withdrawalRequest', requestId],
    queryFn: async () => {
      const res = await http.get('/auth/me');
      const listRes = await http.get(`/users/${res.data.id}/withdrawal-requests`);
      return listRes.data.find((r: WithdrawalRequest) => r.id === requestId);
    },
  });

  const watchAdMutation = useMutation({
    mutationFn: () => http.post(`/withdrawal-requests/${requestId}/watch-ad`),
    onSuccess: async () => {
      setShowAd(false);
      await refetch();
      feedback.success('Task recorded and fee calculation updated.');
    },
    onError: (error) => feedback.error(getApiErrorMessage(error, 'The task completion could not be recorded.')),
  });

  const skipAdsMutation = useMutation({
    mutationFn: () => http.post(`/withdrawal-requests/${requestId}/skip-ads`),
    onSuccess: async () => {
      await refetch();
      feedback.success('Platform fee accepted.');
    },
    onError: (error) => feedback.error(getApiErrorMessage(error, 'Could not update fee preference.')),
  });

  if (isRequestError) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
        <div role="alert" className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-xl">
          <p className="font-semibold text-red-700">{getApiErrorMessage(requestError, 'The withdrawal details could not be loaded.')}</p>
          <div className="mt-5 flex justify-center gap-3">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Close</button>
            <button type="button" onClick={() => void refetch()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Try again</button>
          </div>
        </div>
      </div>
    );
  }

  if (!req) return <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center"><div className="bg-white p-6 rounded text-center" role="status">Loading payout details...</div></div>;

  const grossAmount = Number(req.gross_amount || req.amount || 0);
  const platformFee = Number(req.platform_fee || 0);
  const bankFee = Number(req.bank_fee || 0);
  const isWaived = Boolean(req.fee_waived);
  const netAmount = Number(req.net_amount || (grossAmount - (isWaived ? 0 : platformFee) - bankFee));

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden relative">
        <button
          type="button"
          onClick={onClose}
          disabled={skipAdsMutation.isPending || watchAdMutation.isPending}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 disabled:opacity-50"
          aria-label="Close withdrawal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-4 sm:p-6 text-center border-b border-gray-100">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3">
            <CheckCircle className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Automatic Payout Queued</h2>
          <p className="text-gray-500 text-xs mt-1">
            ₱{grossAmount.toFixed(2)} to {req.payment_method} ({req.payment_account_info})
          </p>
        </div>

        <div className="p-4 sm:p-6 bg-gray-50 space-y-4 sm:space-y-6">
          {/* Fee & Net Breakdown */}
          <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200 text-xs sm:text-sm space-y-2">
            <div className="flex justify-between text-gray-600">
              <span>Gross Amount</span>
              <span className="font-semibold text-gray-900">₱{grossAmount.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center text-gray-600">
              <span>Platform Fee</span>
              {isWaived ? (
                <span className="font-semibold text-emerald-600 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Waived! (₱0.00)
                </span>
              ) : (
                <span className="font-semibold text-red-500">-₱{platformFee.toFixed(2)}</span>
              )}
            </div>

            {bankFee > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Bank Processing Fee</span>
                <span className="font-semibold text-red-500">-₱{bankFee.toFixed(2)}</span>
              </div>
            )}

            <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between font-bold text-base text-gray-900">
              <span>Net Payout</span>
              <span className="text-emerald-600 font-bold">₱{netAmount.toFixed(2)}</span>
            </div>
          </div>

          {/* Task Waiver Progress */}
          {isWaived ? (
            <div className="text-center space-y-3 bg-emerald-50 border border-emerald-200 p-4 rounded-lg">
              <p className="text-sm font-semibold text-emerald-800">
                🎉 Platform fee waived!
              </p>
              <p className="text-xs text-emerald-700">
                You completed 10 in-app tasks. Your full payout of ₱{netAmount.toFixed(2)} is pending admin review.
              </p>
              <button
                onClick={onClose}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg font-medium text-sm transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="text-center">
              <p className="font-medium text-gray-900 text-sm mb-1.5">
                Complete designated in-app tasks to waive the ₱{platformFee.toFixed(2)} platform fee
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, ((req.ads_watched_count || 0) / 10) * 100)}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mb-4">{req.ads_watched_count || 0} / 10 tasks completed</p>

              <div className="space-y-3">
                <button
                  onClick={() => setShowAd(true)}
                  disabled={skipAdsMutation.isPending || watchAdMutation.isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 font-bold text-white text-sm hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  <span>Complete In-App Task (Ad)</span>
                </button>
                <button
                  onClick={() => skipAdsMutation.mutate()}
                  disabled={skipAdsMutation.isPending || watchAdMutation.isPending}
                  aria-busy={skipAdsMutation.isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-200 py-2.5 font-medium text-gray-700 text-sm hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
                >
                  {skipAdsMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FastForward className="w-4 h-4" />}
                  <span>{skipAdsMutation.isPending ? 'Submitting...' : `Skip Tasks (Accept ₱${platformFee.toFixed(2)} Fee)`}</span>
                </button>
              </div>
            </div>
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
    </div>
  );
};