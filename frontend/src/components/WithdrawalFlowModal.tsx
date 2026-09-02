import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import http from '../api/http';
import { X, Play, FastForward, CheckCircle } from 'lucide-react';
import { MockRewardedAd } from './MockRewardedAd';

export const WithdrawalFlowModal = ({ requestId, onClose }: { requestId: string, onClose: () => void }) => {
  const [showAd, setShowAd] = useState(false);

  // We need to fetch the request to know its status
  const { data: req, refetch } = useQuery({
    queryKey: ['withdrawalRequest', requestId],
    queryFn: async () => {
      const res = await http.get('/auth/me');
      const listRes = await http.get(`/users/${res.data.id}/withdrawal-requests`);
      return listRes.data.find((r: any) => r.id === requestId);
    }
  });

  const watchAdMutation = useMutation({
    mutationFn: () => http.post(`/withdrawal-requests/${requestId}/watch-ad`),
    onSuccess: () => {
      refetch();
    }
  });

  const skipAdsMutation = useMutation({
    mutationFn: () => http.post(`/withdrawal-requests/${requestId}/skip-ads`),
    onSuccess: () => {
      refetch();
    }
  });

  if (!req) return <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center"><div className="bg-white p-6 rounded text-center">Loading...</div></div>;

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 text-center border-b border-gray-100">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Eligible for Withdrawal!</h2>
          <p className="text-gray-500 mt-2">You are withdrawing ₱{req.amount} to {req.payment_method}</p>
        </div>

        <div className="p-6 bg-gray-50">
          {req.status === 'pending_review' ? (
            <div className="text-center space-y-4">
              <p className="text-gray-700">Your request has been submitted for review.</p>
              <p className="text-sm text-gray-500">Platform Fee: {req.fee_waived ? 'Waived!' : `₱${req.platform_fee}`}</p>
              <button onClick={onClose} className="w-full bg-primary text-white py-2 rounded font-medium">Done</button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white p-4 rounded border border-gray-200">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Withdrawal Amount</span>
                  <span className="font-semibold">₱{req.amount}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Platform Fee</span>
                  <span className="font-semibold text-red-500">-₱{req.platform_fee}</span>
                </div>
                {req.bank_fee > 0 && (
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Bank Processing Fee</span>
                    <span className="font-semibold text-red-500">-₱{req.bank_fee}</span>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between font-bold text-lg">
                  <span>Net Payout</span>
                  <span className="text-green-600">₱{(req.amount - req.platform_fee - req.bank_fee).toFixed(2)}</span>
                </div>
              </div>

              <div className="text-center">
                <p className="font-medium text-gray-900 mb-2">Watch 10 short ads to waive the ₱{req.platform_fee} platform fee?</p>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4 dark:bg-gray-700">
                  <div className="bg-primary h-2.5 rounded-full" style={{ width: `${(req.ads_watched_count / 10) * 100}%` }}></div>
                </div>
                <p className="text-xs text-gray-500 mb-4">{req.ads_watched_count} / 10 ads watched</p>

                <div className="space-y-3">
                  <button 
                    onClick={() => setShowAd(true)} 
                    className="w-full bg-primary text-white py-3 rounded-lg font-bold flex items-center justify-center space-x-2 hover:bg-primary-dark"
                  >
                    <Play className="w-5 h-5" />
                    <span>Watch Ad</span>
                  </button>
                  <button 
                    onClick={() => skipAdsMutation.mutate()}
                    className="w-full bg-gray-100 text-gray-600 py-3 rounded-lg font-medium flex items-center justify-center space-x-2 hover:bg-gray-200"
                  >
                    <FastForward className="w-5 h-5" />
                    <span>Skip Ads (Accept Fee)</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showAd && (
        <MockRewardedAd onComplete={() => {
          setShowAd(false);
          watchAdMutation.mutate();
        }} />
      )}
    </div>
  );
};
