import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import http from '../api/http';
import { DollarSign, BookOpen, Banknote, AlertCircle, Settings, Clock, Sparkles, CheckCircle2, Users, Wallet } from 'lucide-react';
import { WithdrawalFlowModal } from '../components/WithdrawalFlowModal';
import { UpgradePlanModal } from '../components/UpgradePlanModal';
import { ReadingIncomeSection } from '../components/ReadingIncomeSection';
import { WatchAdsTaskSection } from '../components/earnings/WatchAdsTaskSection';
import { ReferralProgramSection } from '../components/earnings/ReferralProgramSection';
import { WithdrawalTermsCard } from '../components/WithdrawalTermsCard';
import { CompactDailyRewardCard } from '../components/DailyLoginRewardPanel';
import { useDailyLoginReward } from '../hooks/useDailyLoginReward';
import { formatCoins, formatPesoFromCoins } from '../utils/money';
import { useFeedback } from '../components/feedback/feedback';
import { getApiErrorMessage } from '../utils/apiError';
import type { WithdrawalPolicy, WithdrawalRequest } from '../types/withdrawals';

export const EarningsDashboard = () => {
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const feedback = useFeedback();
  const { hasAvailableReward } = useDailyLoginReward();

  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'referrals'>('overview');
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
      feedback.success('Payment method saved.');
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
      {/* Dashboard Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Earnings & Payouts</h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Track reading coins, author income, tasks, and automated withdrawals
          </p>
        </div>
        <button
          onClick={() => setShowUpgradeModal(true)}
          className="flex items-center px-4 py-2.5 bg-primary text-white rounded-xl shadow-xs hover:bg-primary-hover active:scale-98 transition-all text-xs sm:text-sm font-bold cursor-pointer shrink-0"
        >
          {user?.plan === 'free' ? 'Upgrade Plan' : `Manage ${user?.plan} Plan`}
        </button>
      </div>

      {/* 3-Tab Segmented Navigation */}
      <div className="flex gap-2 p-1.5 bg-gray-100 dark:bg-slate-800 rounded-2xl mb-6 sm:mb-8 max-w-xl">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 shadow-xs'
              : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
          }`}
        >
          <Wallet className="w-4 h-4 text-primary" />
          <span>Overview & Payouts</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tasks')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer relative ${
            activeTab === 'tasks'
              ? 'bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 shadow-xs'
              : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-primary" />
          <span>Daily Earning Tasks</span>
          {hasAvailableReward && (
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('referrals')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'referrals'
              ? 'bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 shadow-xs'
              : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
          }`}
        >
          <Users className="w-4 h-4 text-primary" />
          <span>Referrals</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & PAYOUTS */}
      {activeTab === 'overview' && (
        <div className="space-y-6 sm:space-y-8">
          {/* Overview Cards: Reader / Author / Referral 3-Card Layout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-gray-200 dark:border-slate-800 p-4 sm:p-6 flex items-center">
              <div className="bg-primary/10 p-3 sm:p-4 rounded-xl mr-4 sm:mr-6 shrink-0 text-primary">
                <BookOpen className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-0.5 sm:mb-1">Reader Coins</p>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">{formatCoins(user?.readerCoins || 0)}</h2>
                <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">
                  {formatPesoFromCoins(user?.readerCoins || 0)} cash value (100 coins = ₱1)
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-gray-200 dark:border-slate-800 p-4 sm:p-6 flex items-center">
              <div className="bg-primary/10 p-3 sm:p-4 rounded-xl mr-4 sm:mr-6 shrink-0 text-primary">
                <DollarSign className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-0.5 sm:mb-1">Author Income</p>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(user?.authorIncome || 0)}</h2>
                <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">Earned from published stories</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-gray-200 dark:border-slate-800 p-4 sm:p-6 flex items-center sm:col-span-2 lg:col-span-1">
              <div className="bg-[#F5E9DA] dark:bg-amber-950/40 p-3 sm:p-4 rounded-xl mr-4 sm:mr-6 shrink-0 text-stone-800 dark:text-amber-200">
                <Users className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-0.5 sm:mb-1">Referral Network</p>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">{user?.referralCount || 0} <span className="text-sm font-normal text-gray-500">invites</span></h2>
                <p className="text-[11px] sm:text-xs text-primary mt-0.5 sm:mt-1 font-medium">Up to 550 coins / friend + 5% comm.</p>
              </div>
            </div>
          </div>

          {/* Active Withdrawal Status Card */}
          {activeRequest && (
            <div className="bg-[#F5E9DA]/50 dark:bg-amber-950/20 border-l-4 border-l-primary p-6 rounded-r-2xl border border-amber-200/80 dark:border-amber-900/40 shadow-xs">
              <div className="flex items-start">
                <AlertCircle className="w-6 h-6 text-primary mt-0.5 mr-3 flex-shrink-0" />
                <div className="w-full">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <h3 className="text-lg font-bold text-stone-900 dark:text-amber-100">Active Automatic Payout</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase bg-primary/10 text-primary border border-primary/20">
                      {activeRequest.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-stone-700 dark:text-stone-300">
                    Your payout of <strong>₱{activeRequest.gross_amount || activeRequest.amount}</strong> to{' '}
                    <strong>{activeRequest.payment_method}</strong> ({activeRequest.payment_account_info}) was
                    automatically queued.
                  </p>

                  {/* Financial Breakdown */}
                  <div className="mt-4 bg-white/90 dark:bg-slate-900/90 rounded-xl p-4 border border-stone-200 dark:border-slate-800 text-xs space-y-1.5">
                    <div className="flex justify-between text-gray-700 dark:text-gray-300">
                      <span>Gross Amount:</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">₱{activeRequest.gross_amount || activeRequest.amount}</span>
                    </div>
                    <div className="flex justify-between text-gray-700 dark:text-gray-300">
                      <span>Platform Fee:</span>
                      {activeRequest.fee_waived ? (
                        <span className="text-primary font-semibold flex items-center">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Waived (Tasks Completed)
                        </span>
                      ) : (
                        <span className="text-accent font-semibold">-₱{activeRequest.platform_fee}</span>
                      )}
                    </div>
                    {Number(activeRequest.bank_fee) > 0 && (
                      <div className="flex justify-between text-gray-700 dark:text-gray-300">
                        <span>Bank Processing Fee:</span>
                        <span className="text-accent font-semibold">-₱{activeRequest.bank_fee}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 dark:border-slate-800 pt-1.5 flex justify-between font-bold text-sm text-gray-900 dark:text-gray-100">
                      <span>Net Payout:</span>
                      <span className="text-primary font-bold">
                        ₱{activeRequest.net_amount || (
                          Number(activeRequest.amount) -
                          (activeRequest.fee_waived ? 0 : Number(activeRequest.platform_fee)) -
                          Number(activeRequest.bank_fee)
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Timeline & Action */}
                  <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-700 dark:text-stone-300">
                    <div className="flex items-center space-x-1.5 text-gray-500">
                      <Clock className="w-3.5 h-3.5 text-primary" />
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
                        className="px-4 py-2 bg-primary text-white rounded-xl shadow-xs hover:bg-primary-hover font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
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

          {/* Payment Method Settings & History Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Left Column: Payment Setup */}
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-gray-200 dark:border-slate-800 overflow-hidden">
                <div className="border-b border-gray-200 dark:border-slate-800 px-6 py-4 bg-[#F5E9DA]/30 dark:bg-slate-800/40 flex justify-between items-center">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center">
                    <Settings className="w-5 h-5 mr-2 text-primary" />
                    Payout Destination Settings
                  </h3>
                  {!isEditingPayment && (
                    <button
                      onClick={() => setIsEditingPayment(true)}
                      className="text-xs sm:text-sm text-primary hover:underline font-semibold cursor-pointer"
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
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Method</label>
                        <select
                          disabled={savePaymentMutation.isPending}
                          value={method}
                          onChange={(e) => setMethod(e.target.value)}
                          className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-gray-100 p-2.5 text-xs sm:text-sm disabled:opacity-60"
                        >
                          <option value="GCash">GCash (Min. ₱{policy?.min_gcash_maya ?? 10})</option>
                          <option value="Maya">Maya (Min. ₱{policy?.min_gcash_maya ?? 10})</option>
                          <option value="Bank Transfer">Bank Transfer (Min. ₱{policy?.min_bank ?? 20} + ₱{policy?.bank_fee ?? 10} bank fee)</option>
                        </select>
                      </div>

                      {method === 'Bank Transfer' && (
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Bank Name</label>
                          <input
                            type="text"
                            disabled={savePaymentMutation.isPending}
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            required
                            className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-gray-100 p-2.5 text-xs sm:text-sm disabled:opacity-60"
                            placeholder="e.g. BDO, BPI, UnionBank"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Account Number / Mobile Number
                        </label>
                        <input
                          type="text"
                          disabled={savePaymentMutation.isPending}
                          value={account}
                          onChange={(e) => setAccount(e.target.value)}
                          required
                          className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-gray-100 p-2.5 text-xs sm:text-sm disabled:opacity-60"
                          placeholder="09XX XXX XXXX or Account No"
                        />
                      </div>

                      <div className="flex justify-end space-x-3 pt-2">
                        {user?.payment_method && (
                          <button
                            type="button"
                            disabled={savePaymentMutation.isPending}
                            onClick={() => setIsEditingPayment(false)}
                            className="px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl disabled:opacity-50 cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          type="submit"
                          disabled={savePaymentMutation.isPending}
                          className="px-5 py-2 text-xs sm:text-sm font-bold text-white bg-primary hover:bg-primary-hover rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
                        >
                          {savePaymentMutation.isPending ? 'Saving...' : 'Save Settings'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-3 text-xs sm:text-sm">
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Method</p>
                        <p className="font-semibold text-gray-900 dark:text-gray-100 mt-0.5">{user?.payment_method}</p>
                      </div>
                      {user?.payment_method === 'Bank Transfer' && (
                        <div>
                          <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Bank Name</p>
                          <p className="font-semibold text-gray-900 dark:text-gray-100 mt-0.5">{user?.bank_name}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Account Info</p>
                        <p className="font-semibold text-gray-900 dark:text-gray-100 mt-0.5">{user?.payment_account_info}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: History */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-gray-200 dark:border-slate-800 overflow-hidden">
                <div className="border-b border-gray-200 dark:border-slate-800 px-6 py-4 bg-[#F5E9DA]/30 dark:bg-slate-800/40">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center">
                    <Banknote className="w-5 h-5 mr-2 text-primary" />
                    Payout History
                  </h3>
                </div>
                <div className="p-0">
                  <ul className="divide-y divide-gray-100 dark:divide-slate-800 max-h-[420px] overflow-y-auto">
                    {withdrawalRequests?.map((req) => (
                      <li key={req.id} className="p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                        <div className="flex justify-between items-center mb-1">
                          <div>
                            <span className="font-bold text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                              Net: ₱{req.net_amount || req.amount}
                            </span>
                            <span className="text-[11px] text-gray-400 block">
                              Gross: ₱{req.gross_amount || req.amount}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                              req.status === 'completed'
                                ? 'bg-green-100 text-green-800'
                                : req.status === 'approved'
                                ? 'bg-primary/15 text-primary'
                                : req.status === 'rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {req.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px] text-gray-500 mt-1.5">
                          <span>{req.payment_method}</span>
                          <span>{new Date(req.created_at).toLocaleDateString()}</span>
                        </div>
                        {req.rejection_reason && (
                          <p className="mt-1 text-xs text-red-600 bg-red-50 dark:bg-red-950/40 p-1.5 rounded-lg">
                            Reason: {req.rejection_reason}
                          </p>
                        )}
                        {req.payout_reference && (
                          <p className="mt-1 text-xs text-primary font-mono">
                            Ref: {req.payout_reference}
                          </p>
                        )}
                      </li>
                    ))}
                    {(!withdrawalRequests || withdrawalRequests.length === 0) && (
                      <li className="p-6 text-center text-gray-500 text-xs sm:text-sm">No payout history yet.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Terms & Conditions Card */}
          <WithdrawalTermsCard
            policy={policy}
            userPaymentMethod={user?.payment_method}
            hasPaymentDetails={hasPaymentDetails}
            readerCoins={user?.readerCoins || 0}
            onSetupPayment={() => setIsEditingPayment(true)}
          />
        </div>
      )}

      {/* TAB 2: DAILY EARNING TASKS */}
      {activeTab === 'tasks' && (
        <div className="space-y-6 sm:space-y-8">
          {/* Compact Daily Check-in Status Card */}
          <CompactDailyRewardCard />

          {/* Reading Income Active Section */}
          <ReadingIncomeSection />

          {/* Watch Ads Task Section */}
          <WatchAdsTaskSection />
        </div>
      )}

      {/* TAB 3: REFERRALS & MILESTONES */}
      {activeTab === 'referrals' && (
        <div className="space-y-6 sm:space-y-8">
          <ReferralProgramSection />
        </div>
      )}

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