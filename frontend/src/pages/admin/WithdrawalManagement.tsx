import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import http from '../../api/http';
import { CheckCircle, XCircle, SendHorizontal, Clock, Calendar } from 'lucide-react';
import { ActionDialog } from '../../components/feedback/ActionDialog';
import { useFeedback } from '../../components/feedback/feedback';
import { getApiErrorMessage } from '../../utils/apiError';
import type { WithdrawalRequest } from '../../types/withdrawals';

export const WithdrawalManagement = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'history'>('pending');
  const [requestToReject, setRequestToReject] = useState<WithdrawalRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [requestToComplete, setRequestToComplete] = useState<WithdrawalRequest | null>(null);
  const [payoutReference, setPayoutReference] = useState('');

  const queryClient = useQueryClient();
  const feedback = useFeedback();

  const { data: pending, isLoading: isLoadingPending, isError: isPendingError } = useQuery<WithdrawalRequest[]>({
    queryKey: ['admin', 'withdrawals', 'pending'],
    queryFn: async () => {
      const res = await http.get('/admin/withdrawals/pending-review');
      return res.data;
    },
  });

  const { data: approved, isLoading: isLoadingApproved, isError: isApprovedError } = useQuery<WithdrawalRequest[]>({
    queryKey: ['admin', 'withdrawals', 'approved'],
    queryFn: async () => {
      const res = await http.get('/admin/withdrawals/approved');
      return res.data;
    },
  });

  const { data: history, isLoading: isLoadingHistory, isError: isHistoryError } = useQuery<WithdrawalRequest[]>({
    queryKey: ['admin', 'withdrawals', 'history'],
    queryFn: async () => {
      const res = await http.get('/admin/withdrawals/completed');
      return res.data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => http.post(`/admin/withdrawals/${id}/approve`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'withdrawals'] });
      feedback.success('Withdrawal approved and moved to processing.');
    },
    onError: (error) => feedback.error(getApiErrorMessage(error, 'The withdrawal could not be approved.')),
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, reference }: { id: string; reference?: string }) =>
      http.post(`/admin/withdrawals/${id}/complete`, { payout_reference: reference }),
    onSuccess: async () => {
      setRequestToComplete(null);
      setPayoutReference('');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'withdrawals'] });
      feedback.success('Payout marked as completed.');
    },
    onError: (error) => feedback.error(getApiErrorMessage(error, 'The payout could not be marked as completed.')),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      http.post(`/admin/withdrawals/${id}/reject`, { reason }),
    onSuccess: async () => {
      setRequestToReject(null);
      setRejectionReason('');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'withdrawals'] });
      feedback.success('Withdrawal rejected and funds refunded to user.');
    },
    onError: (error) => feedback.error(getApiErrorMessage(error, 'The withdrawal could not be rejected.')),
  });

  const renderWithdrawalRow = (req: WithdrawalRequest, showActions: 'pending' | 'approved' | 'none') => {
    const gross = req.gross_amount || req.amount;
    const net = req.net_amount || req.amount;
    const isSundayDeferred = req.earliest_review_at && req.triggered_at &&
      new Date(req.earliest_review_at).getDate() !== new Date(req.triggered_at).getDate();

    return (
      <tr key={req.id} className="hover:bg-gray-50 transition-colors">
        {/* User */}
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
          <div>{req.user?.username || 'User'}</div>
          <span className="text-xs text-gray-400 font-normal">{req.user?.email || req.userId.substring(0, 8)}</span>
        </td>

        {/* Amount & Net Payout */}
        <td className="px-6 py-4 whitespace-nowrap text-sm">
          <div className="font-bold text-gray-900">Net: ₱{net}</div>
          <div className="text-xs text-gray-500">Gross: ₱{gross}</div>
        </td>

        {/* Method & Destination Snapshot */}
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
          <div className="font-medium">{req.payment_method}</div>
          <div className="font-mono text-xs text-gray-500">{req.payment_account_info}</div>
          {req.bank_name && <div className="text-xs text-purple-600 font-medium">Bank: {req.bank_name}</div>}
        </td>

        {/* Fees & Waiver Status */}
        <td className="px-6 py-4 whitespace-nowrap text-sm">
          {req.fee_waived ? (
            <span className="text-emerald-600 font-medium flex items-center text-xs">
              <CheckCircle className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
              ₱{req.platform_fee} Platform Waived ({req.ads_watched_count}/10)
            </span>
          ) : (
            <span className="text-red-500 font-medium flex items-center text-xs">
              <XCircle className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
              -₱{req.platform_fee} Platform Fee
            </span>
          )}
          {Number(req.bank_fee) > 0 && (
            <span className="text-purple-600 font-medium block text-xs mt-0.5">
              -₱{req.bank_fee} Bank Fee
            </span>
          )}
        </td>

        {/* Schedule & Timing */}
        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 space-y-1">
          <div className="flex items-center text-gray-600">
            <Clock className="w-3.5 h-3.5 mr-1 text-gray-400" />
            Queued: {new Date(req.created_at).toLocaleDateString()}
          </div>
          {isSundayDeferred && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-800">
              <Calendar className="w-3 h-3 mr-0.5" />
              Sunday Deferral
            </span>
          )}
          {req.estimated_deadline_at && (
            <div className="text-gray-400 text-[11px]">
              Deadline: {new Date(req.estimated_deadline_at).toLocaleDateString()}
            </div>
          )}
        </td>

        {/* Actions / Status */}
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
          {showActions === 'pending' && (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                disabled={approveMutation.isPending || rejectMutation.isPending}
                onClick={() => approveMutation.mutate(req.id)}
                className="rounded bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={approveMutation.isPending || rejectMutation.isPending}
                onClick={() => setRequestToReject(req)}
                className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
              >
                Reject
              </button>
            </div>
          )}

          {showActions === 'approved' && (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                disabled={completeMutation.isPending || rejectMutation.isPending}
                onClick={() => setRequestToComplete(req)}
                className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 shadow-sm flex items-center gap-1"
              >
                <SendHorizontal className="w-3 h-3" />
                Mark Sent
              </button>
              <button
                type="button"
                disabled={completeMutation.isPending || rejectMutation.isPending}
                onClick={() => setRequestToReject(req)}
                className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
              >
                Reject
              </button>
            </div>
          )}

          {showActions === 'none' && (
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                req.status === 'completed'
                  ? 'bg-emerald-100 text-emerald-800'
                  : req.status === 'rejected'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {req.status.toUpperCase()}
            </span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">Withdrawal Management</h1>

      <div className="flex space-x-4 mb-6 border-b border-gray-200">
        <button
          type="button"
          aria-pressed={activeTab === 'pending'}
          onClick={() => setActiveTab('pending')}
          className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
            activeTab === 'pending'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Pending Review ({pending?.length || 0})
        </button>

        <button
          type="button"
          aria-pressed={activeTab === 'approved'}
          onClick={() => setActiveTab('approved')}
          className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
            activeTab === 'approved'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Approved / In Processing ({approved?.length || 0})
        </button>

        <button
          type="button"
          aria-pressed={activeTab === 'history'}
          onClick={() => setActiveTab('history')}
          className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
            activeTab === 'history'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          History ({history?.length || 0})
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
        {activeTab === 'pending' && (
          <div>
            {isLoadingPending && <p role="status" className="p-8 text-center text-gray-500">Loading pending review queue...</p>}
            {isPendingError && <p role="alert" className="p-8 text-center text-red-600">Pending withdrawals could not be loaded.</p>}
            {!isLoadingPending && !isPendingError && (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Destination</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Fees & Waiver</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Schedule</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pending?.map((req) => renderWithdrawalRow(req, 'pending'))}
                  {(!pending || pending.length === 0) && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500 text-sm">
                        No pending payouts for review.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'approved' && (
          <div>
            {isLoadingApproved && <p role="status" className="p-8 text-center text-gray-500">Loading approved queue...</p>}
            {isApprovedError && <p role="alert" className="p-8 text-center text-red-600">Approved withdrawals could not be loaded.</p>}
            {!isLoadingApproved && !isApprovedError && (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Destination</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Fees</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Schedule</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Disbursement</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {approved?.map((req) => renderWithdrawalRow(req, 'approved'))}
                  {(!approved || approved.length === 0) && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500 text-sm">
                        No payouts currently in processing.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            {isLoadingHistory && <p role="status" className="p-8 text-center text-gray-500">Loading history...</p>}
            {isHistoryError && <p role="alert" className="p-8 text-center text-red-600">Withdrawal history could not be loaded.</p>}
            {!isLoadingHistory && !isHistoryError && (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Destination</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Fees</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Dates</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Final Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {history?.map((req) => renderWithdrawalRow(req, 'none'))}
                  {(!history || history.length === 0) && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500 text-sm">
                        No completed or rejected payouts yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      <ActionDialog
        open={Boolean(requestToReject)}
        title="Reject payout?"
        description={`Provide a reason for rejecting ${requestToReject?.user?.username ?? 'this user'}'s payout. The reserved coins will be refunded immediately.`}
        confirmLabel="Reject and Refund"
        pendingLabel="Rejecting..."
        tone="danger"
        isPending={rejectMutation.isPending}
        input={{
          label: 'Rejection Reason',
          value: rejectionReason,
          onChange: setRejectionReason,
          placeholder: 'e.g. Invalid account number, name mismatch',
          required: true,
          maxLength: 500,
        }}
        onCancel={() => {
          if (!rejectMutation.isPending) {
            setRequestToReject(null);
            setRejectionReason('');
          }
        }}
        onConfirm={() => {
          if (requestToReject && rejectionReason.trim()) {
            rejectMutation.mutate({ id: requestToReject.id, reason: rejectionReason.trim() });
          }
        }}
      />

      {/* Complete / Mark Sent Modal */}
      <ActionDialog
        open={Boolean(requestToComplete)}
        title="Mark payout as sent"
        description={`Confirm disbursement of ₱${requestToComplete?.net_amount || requestToComplete?.amount} to ${requestToComplete?.payment_method} (${requestToComplete?.payment_account_info}).`}
        confirmLabel="Confirm Disbursement"
        pendingLabel="Completing..."
        tone="default"
        isPending={completeMutation.isPending}
        input={{
          label: 'Payout Reference / Transaction ID (Optional)',
          value: payoutReference,
          onChange: setPayoutReference,
          placeholder: 'e.g. GCASH-12345678, Bank Ref #',
          required: false,
          maxLength: 255,
        }}
        onCancel={() => {
          if (!completeMutation.isPending) {
            setRequestToComplete(null);
            setPayoutReference('');
          }
        }}
        onConfirm={() => {
          if (requestToComplete) {
            completeMutation.mutate({ id: requestToComplete.id, reference: payoutReference.trim() || undefined });
          }
        }}
      />
    </div>
  );
};

export default WithdrawalManagement;