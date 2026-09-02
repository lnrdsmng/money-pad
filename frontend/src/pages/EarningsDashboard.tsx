import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import http from '../api/http';
import { DollarSign, BookOpen, Banknote, AlertCircle, Settings } from 'lucide-react';
import { WithdrawalFlowModal } from '../components/WithdrawalFlowModal';
import { UpgradePlanModal } from '../components/UpgradePlanModal';
import { ReadingIncomeSection } from '../components/ReadingIncomeSection';

const formatReadingIncome = (value: number | string) => `₱${Number(value || 0).toFixed(3)}`;

export const EarningsDashboard = () => {
  const { user, updateUser, checkAuth } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  // Form states for payment setup
  const [method, setMethod] = useState(user?.payment_method || 'GCash');
  const [account, setAccount] = useState(user?.payment_account_info || '');
  const [bankName, setBankName] = useState(user?.bank_name || '');
  const [isEditingPayment, setIsEditingPayment] = useState(!user?.payment_method);
  const planPaymentStatus = searchParams.get('plan_payment');

  useEffect(() => {
    if (planPaymentStatus !== 'success') return;

    let attempts = 0;
    void checkAuth();
    const refreshTimer = window.setInterval(() => {
      attempts += 1;
      void checkAuth();
      if (attempts >= 5) window.clearInterval(refreshTimer);
    }, 3_000);

    return () => window.clearInterval(refreshTimer);
  }, [planPaymentStatus, checkAuth]);

  const { data: withdrawalRequests } = useQuery({
    queryKey: ['withdrawals', user?.id],
    queryFn: async () => {
      const res = await http.get(`/users/${user?.id}/withdrawal-requests`);
      return res.data;
    },
    enabled: !!user?.id
  });

  const savePaymentMutation = useMutation({
    mutationFn: async () => {
      const res = await http.put(`/users/${user?.id}/profile`, {
        payment_method: method,
        payment_account_info: account,
        bank_name: method === 'Bank Transfer' ? bankName : null
      });
      return res.data;
    },
    onSuccess: (data) => {
      updateUser(data.user);
      setIsEditingPayment(false);
      alert('Payment method saved!');
    }
  });

  // active request
  const activeRequest = withdrawalRequests?.find((r: any) => 
    ['eligible', 'pending_ad_choice', 'watching_ads', 'pending_review'].includes(r.status)
  );

  const formatCurrency = (val: number | string) => `₱${parseFloat(val as string || '0').toFixed(2)}`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Earnings Dashboard</h1>
        <button 
          onClick={() => setShowUpgradeModal(true)}
          className="flex items-center px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg shadow-md hover:shadow-lg transition-all font-medium"
        >
          {user?.plan === 'free' ? 'Upgrade Plan' : `Manage ${user?.plan} Plan`}
        </button>
      </div>

      {planPaymentStatus === 'success' && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Payment submitted. Your plan will appear here after the payment provider verifies it.
        </div>
      )}
      {planPaymentStatus === 'cancelled' && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Checkout was cancelled. Your current plan was not changed.
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center">
          <div className="bg-green-100 p-4 rounded-full mr-6">
            <BookOpen className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Reader Coins</p>
            <h2 className="text-3xl font-bold text-gray-900">{formatReadingIncome(user?.readerCoins || 0)}</h2>
            <p className="text-xs text-gray-400 mt-1">Earned by reading stories</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center">
          <div className="bg-blue-100 p-4 rounded-full mr-6">
            <DollarSign className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Author Income</p>
            <h2 className="text-3xl font-bold text-gray-900">{formatCurrency(user?.authorIncome || 0)}</h2>
            <p className="text-xs text-gray-400 mt-1">Earned from published stories</p>
          </div>
        </div>
      </div>

      <ReadingIncomeSection />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Payment & Active Status */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Active Withdrawal Status */}
          {activeRequest && (
            <div className="bg-orange-50 border-l-4 border-orange-500 p-6 rounded-r-lg shadow-sm">
              <div className="flex items-start">
                <AlertCircle className="w-6 h-6 text-orange-500 mt-0.5 mr-3" />
                <div>
                  <h3 className="text-lg font-medium text-orange-800">Active Withdrawal Request</h3>
                  <p className="mt-1 text-sm text-orange-700">
                    You have a withdrawal request of <strong>₱{activeRequest.amount}</strong> currently in status: <span className="uppercase font-semibold">{activeRequest.status.replace(/_/g, ' ')}</span>
                  </p>
                  
                  {['eligible', 'pending_ad_choice', 'watching_ads'].includes(activeRequest.status) && (
                    <button 
                      onClick={() => {
                        setSelectedRequestId(activeRequest.id);
                        setShowWithdrawalModal(true);
                      }}
                      className="mt-4 px-4 py-2 bg-orange-600 text-white rounded shadow hover:bg-orange-700 font-medium text-sm transition-colors"
                    >
                      Action Required: Complete Request
                    </button>
                  )}
                  
                  {activeRequest.status === 'pending_review' && (
                    <p className="mt-4 text-sm text-orange-700 italic">Please wait while an admin reviews your request. You will be notified once completed.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Payment Method Settings */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-4 bg-gray-50 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Settings className="w-5 h-5 mr-2 text-gray-500" />
                Payment Method
              </h3>
              {!isEditingPayment && (
                <button onClick={() => setIsEditingPayment(true)} className="text-sm text-primary hover:underline font-medium">Edit</button>
              )}
            </div>
            
            <div className="p-6">
              {isEditingPayment ? (
                <form onSubmit={(e) => { e.preventDefault(); savePaymentMutation.mutate(); }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
                    <select value={method} onChange={e => setMethod(e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 border p-2">
                      <option value="GCash">GCash</option>
                      <option value="Maya">Maya</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  </div>
                  
                  {method === 'Bank Transfer' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                      <input type="text" value={bankName} onChange={e => setBankName(e.target.value)} required className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 border p-2" placeholder="e.g. BDO, BPI" />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Number / Details</label>
                    <input type="text" value={account} onChange={e => setAccount(e.target.value)} required className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 border p-2" placeholder="09XX XXX XXXX or Account No" />
                  </div>

                  <div className="flex justify-end space-x-3 pt-2">
                    {user?.payment_method && (
                      <button type="button" onClick={() => setIsEditingPayment(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
                    )}
                    <button type="submit" disabled={savePaymentMutation.isPending} className="px-4 py-2 text-sm text-white bg-primary hover:bg-primary-dark rounded-md disabled:opacity-50">
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
                History
              </h3>
            </div>
            <div className="p-0">
              <ul className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                {withdrawalRequests?.map((req: any) => (
                  <li key={req.id} className="p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-gray-900">₱{req.amount}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        req.status === 'completed' || req.status === 'approved' ? 'bg-green-100 text-green-800' :
                        req.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {req.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{req.payment_method}</span>
                      <span>{new Date(req.created_at).toLocaleDateString()}</span>
                    </div>
                  </li>
                ))}
                {(!withdrawalRequests || withdrawalRequests.length === 0) && (
                  <li className="p-6 text-center text-gray-500 text-sm">No withdrawal history</li>
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
