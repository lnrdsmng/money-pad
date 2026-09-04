import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import http from '../api/http';
import { DollarSign, BookOpen, Banknote, AlertCircle, Settings, Clock, Sparkles, CheckCircle2, Users } from 'lucide-react';
import { WithdrawalFlowModal } from '../components/WithdrawalFlowModal';
import { UpgradePlanModal } from '../components/UpgradePlanModal';
import { ReadingIncomeSection } from '../components/ReadingIncomeSection';
import { WatchAdsTaskSection } from '../components/earnings/WatchAdsTaskSection';
import { ReferralProgramSection } from '../components/earnings/ReferralProgramSection';
import { WithdrawalTermsCard } from '../components/WithdrawalTermsCard';
import { formatCoins, formatPesoFromCoins } from '../utils/money';
import { useFeedback } from '../components/feedback/feedback';
import { getApiErrorMessage } from '../utils/apiError';
import type { WithdrawalPolicy, WithdrawalRequest } from '../types/withdrawals';

export const EarningsDashboard = () => {
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const feedback = useFeedback();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  // Form states for payment setup
  const [method, setMethod] = useState(user?.payment_method || 'GCash');
  const [account, setAccount] = useState(user?.payment_account_info || '');
  const [bankName, setBankName] = useState(user?.bank_name || '');
  const [isEditingPayment, setIsEditingPayment] = useState(!user?.payment_method);

  const { data: policy } = useQuery<WithdrawalPolicy>({
    queryKey: ['withdrawalPolicy'],
    queryFn: async () => {
      const res = await http.get('/withdrawals/policy');
      return res.data;
    },
    staleTime: 1000 * 60 * 10,
  });

  const { data: withdrawalRequests } = useQuery<WithdrawalRequest[]>({
    queryKey: ['withdrawals', user?.id],
    queryFn: async () => {
      const res = await http.get(`/users/${user?.id}/withdrawal-requests`);
      return res.data;
    },
    enabled: !!user?.id,
  });

  const savePaymentMutation = useMutation({
    mutationFn: async () => {
      const res = await http.put(`/users/${user?.id}/profile`, {
        payment_method: method,
        payment_account_info: account,
        bank_name: method === 'Bank Transfer' ? bankName : null,
      });
      return res.data;
    },
    onSuccess: (data) => {
      updateUser(data.user);
      setIsEditingPayment(false);
      queryClient.invalidateQueries({ queryKey: ['withdrawals', user?.id] });
      feedback.success('Payment method saved and auto-withdrawal checked.');
    },
    onError: (error) => feedback.error(getApiErrorMessage(error, 'Your payment method could not be saved.')),
  });

  // active request
  const activeRequest = withdrawalRequests?.find((r) =>
    ['eligible', 'pending_ad_choice', 'watching_ads', 'pending_review', 'approved'].includes(r.status)
  );

  const formatCurrency = (val: number | string) => `₱${parseFloat((val as string) || '0').toFixed(2)}`;

  const hasPaymentDetails = Boolean(
    user?.payment_method &&
      user?.payment_account_info &&
      (user?.payment_method !== 'Bank Transfer' || user?.bank_name)
  );

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Earnings Dashboard</h1>
        <button
          onClick={() => setShowUpgradeModal(true)}
          className="flex items-center px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg shadow-md hover:shadow-lg transition-all text-xs sm:text-sm font-medium"
        >
          {user?.plan === 'free' ? 'Upgrade Plan' : `Manage ${user?.plan} Plan`}
        </button>
      </div>

      {/* Overview Cards: Author / Reader / Referral 3-Card Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 flex items-center">
          <div className="bg-green-100 p-3 sm:p-4 rounded-full mr-4 sm:mr-6 shrink-0">
            <BookOpen className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-medium text-gray-500 mb-0.5 sm:mb-1">Reader Coins</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">{formatCoins(user?.readerCoins || 0)}</h2>
            <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">
              {formatPesoFromCoins(user?.readerCoins || 0)} cash value at 100 coins = ₱1
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 flex items-center">
          <div className="bg-blue-100 p-3 sm:p-4 rounded-full mr-4 sm:mr-6 shrink-0">
            <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-medium text-gray-500 mb-0.5 sm:mb-1">Author Income</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">{formatCurrency(user?.authorIncome || 0)}</h2>
            <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">Earned from published stories</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 flex items-center sm:col-span-2 lg:col-span-1">
          <div className="bg-purple-100 p-3 sm:p-4 rounded-full mr-4 sm:mr-6 shrink-0">
            <Users className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-medium text-gray-500 mb-0.5 sm:mb-1">Referral Program</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">{user?.referralCount || 0} <span className="text-sm font-normal text-gray-500">invites</span></h2>
            <p className="text-[11px] sm:text-xs text-purple-600 mt-0.5 sm:mt-1">Up to 550 coins / friend + 5% comm.</p>
          </div>
        </div>
      </div>

      <ReadingIncomeSection />

      <WatchAdsTaskSection />

      <ReferralProgramSection />

      {/* Terms & Conditions Card */}
      <WithdrawalTermsCard
        policy={policy}
        userPaymentMethod={user?.payment_method}
        hasPaymentDetails={hasPaymentDetails}
        readerCoins={user?.readerCoins || 0}
        onSetupPayment={() => setIsEditingPayment(true)}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Payment & Active Status */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Withdrawal Status Card */}
          {activeRequest && (
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-l-4 border-orange-500 p-6 rounded-r-xl shadow-sm">
              <div className="flex items-start">
                <AlertCircle className="w-6 h-6 text-orange-500 mt-0.5 mr-3 flex-shrink-0" />
                <div className="w-full">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <h3 className="text-lg font-bold text-orange-900">Active Automatic Payout</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase bg-orange-100 text-orange-800 border border-orange-200">
                      {activeRequest.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-orange-800">
                    Your payout of <strong>₱{activeRequest.gross_amount || activeRequest.amount}</strong> to{' '}
                    <strong>{activeRequest.payment_method}</strong> ({activeRequest.payment_account_info}) was
                    automatically queued.
                  </p>

                  {/* Financial Breakdown */}
                  <div className="mt-4 bg-white/80 rounded-lg p-3.5 border border-orange-200 text-xs space-y-1.5">
                    <div className="flex justify-between text-gray-700">
                      <span>Gross Amount:</span>
                      <span className="font-semibold">₱{activeRequest.gross_amount || activeRequest.amount}</span>
                    </div>
                    <div className="flex justify-between text-gray-700">
                      <span>Platform Fee:</span>
                      {activeRequest.fee_waived ? (
                        <span className="text-emerald-600 font-semibold flex items-center">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Waived (Tasks Completed)
                        </span>
                      ) : (
                        <span className="text-red-500 font-semibold">-₱{activeRequest.platform_fee}</span>
                      )}
                    </div>
                    {Number(activeRequest.bank_fee) > 0 && (
                      <div className="flex justify-between text-gray-700">
                        <span>Bank Processing Fee:</span>
                        <span className="text-red-500 font-semibold">-₱{activeRequest.bank_fee}</span>
                      </div>
                    )}
                    <div className="border-t border-orange-200 pt-1.5 flex justify-between font-bold text-sm text-gray-900">
                      <span>Net Payout:</span>
                      <span className="text-emerald-600 font-bold">
                        ₱{activeRequest.net_amount || (
                          Number(activeRequest.amount) -
                          (activeRequest.fee_waived ? 0 : Number(activeRequest.platform_fee)) -
                          Number(activeRequest.bank_fee)
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Timeline & Action */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-orange-700">
                    <div className="flex items-center space-x-1 text-gray-600">
                      <Clock className="w-3.5 h-3.5 text-orange-500" />
                      <span>
                        Turnaround: {policy?.processing_days_label ?? 'Mon–Sat'} (1–7 business days)
                      </span>
                    </div>

                    {!activeRequest.fee_waived && (
                      <button
                        onClick={() => {
                          setSelectedRequestId(activeRequest.id);
                          setShowWithdrawalModal(true);
                        }}
                        className="px-3.5 py-1.5 bg-orange-600 text-white rounded-lg shadow hover:bg-orange-700 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Waive ₱{activeRequest.platform_fee} Fee ({activeRequest.ads_watched_count}/10 tasks)
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Payment Method Settings */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-4 bg-gray-50 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Settings className="w-5 h-5 mr-2 text-gray-500" />
                Payout Destination Settings
              </h3>
              {!isEditingPayment && (
                <button
                  onClick={() => setIsEditingPayment(true)}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  Edit
                </button>
              )}
            </div>

            <div className="p-6">
              {isEditingPayment ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    savePaymentMutation.mutate();
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
                    <select
                      disabled={savePaymentMutation.isPending}
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 border p-2 disabled:opacity-60"
                    >
                      <option value="GCash">GCash (Min. ₱{policy?.min_gcash_maya ?? 10})</option>
                      <option value="Maya">Maya (Min. ₱{policy?.min_gcash_maya ?? 10})</option>
                      <option value="Bank Transfer">Bank Transfer (Min. ₱{policy?.min_bank ?? 20} + ₱{policy?.bank_fee ?? 10} bank fee)</option>
                    </select>
                  </div>

                  {method === 'Bank Transfer' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                      <input
                        type="text"
                        disabled={savePaymentMutation.isPending}
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        required
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 border p-2 disabled:opacity-60"
                        placeholder="e.g. BDO, BPI, UnionBank"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Account Number / Mobile Number
                    </label>
                    <input
                      type="text"
                      disabled={savePaymentMutation.isPending}
                      value={account}
                      onChange={(e) => setAccount(e.target.value)}
                      required
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 border p-2 disabled:opacity-60"
                      placeholder="09XX XXX XXXX or Account No"
                    />
                  </div>

                  <div className="flex justify-end space-x-3 pt-2">
                    {user?.payment_method && (
                      <button
                        type="button"
                        disabled={savePaymentMutation.isPending}
                        onClick={() => setIsEditingPayment(false)}
                        className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={savePaymentMutation.isPending}
                      className="px-4 py-2 text-sm text-white bg-primary hover:bg-primary-dark rounded-md disabled:opacity-50"
                    >
                      {savePaymentMutation.isPending ? 'Saving...' : 'Save Settings'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Method</p>
                    <p className="font-medium text-gray-900">{user?.payment_method}</p>
                  </div>
                  {user?.payment_method === 'Bank Transfer' && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Bank Name</p>
                      <p className="font-medium text-gray-900">{user?.bank_name}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Account Info</p>
                    <p className="font-medium text-gray-900">{user?.payment_account_info}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: History */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-4 bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Banknote className="w-5 h-5 mr-2 text-gray-500" />
                Payout History
              </h3>
            </div>
            <div className="p-0">
              <ul className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                {withdrawalRequests?.map((req) => (
                  <li key={req.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-center mb-1">
                      <div>
                        <span className="font-bold text-gray-900">
                          Net: ₱{req.net_amount || req.amount}
                        </span>
                        <span className="text-xs text-gray-400 block">
                          Gross: ₱{req.gross_amount || req.amount}
                        </span>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          req.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : req.status === 'approved'
                            ? 'bg-blue-100 text-blue-800'
                            : req.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {req.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                      <span>{req.payment_method}</span>
                      <span>{new Date(req.created_at).toLocaleDateString()}</span>
                    </div>
                    {req.rejection_reason && (
                      <p className="mt-1 text-xs text-red-600 bg-red-50 p-1.5 rounded">
                        Reason: {req.rejection_reason}
                      </p>
                    )}
                    {req.payout_reference && (
                      <p className="mt-1 text-xs text-green-700 font-mono">
                        Ref: {req.payout_reference}
                      </p>
                    )}
                  </li>
                ))}
                {(!withdrawalRequests || withdrawalRequests.length === 0) && (
                  <li className="p-6 text-center text-gray-500 text-sm">No payout history yet.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {showWithdrawalModal && selectedRequestId && (
        <WithdrawalFlowModal
          requestId={selectedRequestId}
          onClose={() => {
            setShowWithdrawalModal(false);
            setSelectedRequestId(null);
            queryClient.invalidateQueries({ queryKey: ['withdrawals', user?.id] });
          }}
        />
      )}
      {showUpgradeModal && <UpgradePlanModal onClose={() => setShowUpgradeModal(false)} />}
    </div>
  );
};

export default EarningsDashboard;