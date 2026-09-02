import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import http from '../../api/http';
import { CheckCircle, XCircle, BellRing } from 'lucide-react';

export const WithdrawalManagement = () => {
  const [activeTab, setActiveTab] = useState<'eligible' | 'pending'>('pending');
  const queryClient = useQueryClient();

  const { data: eligible } = useQuery({
    queryKey: ['admin', 'withdrawals', 'eligible'],
    queryFn: async () => {
      const res = await http.get('/admin/withdrawals/eligible');
      return res.data;
    }
  });

  const { data: pending } = useQuery({
    queryKey: ['admin', 'withdrawals', 'pending'],
    queryFn: async () => {
      const res = await http.get('/admin/withdrawals/pending-review');
      return res.data;
    }
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => http.post(`/admin/withdrawals/${id}/approve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'withdrawals', 'pending'] })
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string, reason: string }) => 
      http.post(`/admin/withdrawals/${id}/reject`, { reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'withdrawals', 'pending'] })
  });

  const massNotifyMutation = useMutation({
    mutationFn: () => http.post('/admin/withdrawals/mass-notify'),
    onSuccess: () => alert('Mass notification triggered (simulated for MVP)'),
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">Withdrawal Management</h1>
      
      <div className="flex space-x-4 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('pending')}
          className={`py-2 px-4 border-b-2 font-medium text-sm ${activeTab === 'pending' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Pending Review ({pending?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('eligible')}
          className={`py-2 px-4 border-b-2 font-medium text-sm ${activeTab === 'eligible' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Eligible Users ({eligible?.length || 0})
        </button>
      </div>

      {activeTab === 'pending' && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount & Source</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method & Account</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fee Waived (Ads)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pending?.map((req: any) => (
                <tr key={req.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{req.user?.username}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ₱{req.amount} <span className="text-xs bg-gray-100 px-2 py-1 rounded ml-2">{req.source}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {req.payment_method} <br/>
                    <span className="font-mono text-xs">{req.payment_account_info}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {req.fee_waived ? (
                      <span className="text-green-600 flex items-center"><CheckCircle className="w-4 h-4 mr-1"/> Yes ({req.ads_watched_count}/10)</span>
                    ) : (
                      <span className="text-red-500 flex items-center"><XCircle className="w-4 h-4 mr-1"/> No (Fee: ₱{req.platform_fee})</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onClick={() => approveMutation.mutate(req.id)} className="text-white bg-green-600 hover:bg-green-700 px-3 py-1 rounded mr-2">Approve</button>
                    <button onClick={() => {
                      const reason = prompt('Reason for rejection?');
                      if (reason) rejectMutation.mutate({ id: req.id, reason });
                    }} className="text-white bg-red-600 hover:bg-red-700 px-3 py-1 rounded">Reject</button>
                  </td>
                </tr>
              ))}
              {(!pending || pending.length === 0) && (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No pending withdrawals</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'eligible' && (
        <div>
          <div className="mb-4 flex justify-end">
            <button onClick={() => massNotifyMutation.mutate()} className="bg-primary text-white px-4 py-2 rounded shadow flex items-center hover:bg-primary-dark">
              <BellRing className="w-4 h-4 mr-2" />
              Mass Notify All
            </button>
          </div>
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Created</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {eligible?.map((req: any) => (
                  <tr key={req.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{req.user?.username}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`px-2 py-1 rounded text-xs ${
                        req.status === 'watching_ads' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {req.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₱{req.amount}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(req.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
