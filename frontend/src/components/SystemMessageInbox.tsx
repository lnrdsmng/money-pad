import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import http from '../api/http';
import { useAuth } from '../auth/AuthProvider';
import { Pin, Mail, MailOpen } from 'lucide-react';
import { WithdrawalFlowModal } from './WithdrawalFlowModal';

export const SystemMessageInbox = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ['systemMessages', user?.id],
    queryFn: async () => {
      const res = await http.get(`/users/${user?.id}/system-messages`);
      return res.data;
    },
    enabled: !!user?.id
  });

  const readMutation = useMutation({
    mutationFn: (id: string) => http.put(`/system-messages/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['systemMessages', user?.id] })
  });

  if (isLoading) return <div className="text-center p-4">Loading messages...</div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="border-b border-gray-100 px-6 py-4 bg-gray-50">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <Mail className="w-5 h-5 mr-2 text-gray-500" />
          System Messages
        </h3>
      </div>
      
      <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
        {messages?.length === 0 && (
          <div className="p-6 text-center text-gray-500">No system messages.</div>
        )}
        
        {messages?.map((msg: any) => (
          <div 
            key={msg.id} 
            className={`p-4 transition-colors ${msg.is_read ? 'bg-white' : 'bg-blue-50/50'} ${msg.is_pinned ? 'border-l-4 border-l-primary' : ''}`}
            onClick={() => !msg.is_read && readMutation.mutate(msg.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                {msg.is_pinned ? (
                  <Pin className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                ) : msg.is_read ? (
                  <MailOpen className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                ) : (
                  <Mail className="w-5 h-5 text-blue-500 mt-1 flex-shrink-0" />
                )}
                
                <div>
                  <h4 className={`text-sm ${msg.is_read ? 'font-medium text-gray-700' : 'font-bold text-gray-900'}`}>
                    {msg.title}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">{msg.content}</p>
                  
                  {msg.action_type === 'watch_ads_prompt' && msg.withdrawal_request_id && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRequestId(msg.withdrawal_request_id);
                      }}
                      className="mt-3 px-4 py-2 bg-primary text-white rounded text-sm font-medium hover:bg-primary-dark transition-colors"
                    >
                      Complete Withdrawal
                    </button>
                  )}
                </div>
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                {new Date(msg.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {selectedRequestId && (
        <WithdrawalFlowModal 
          requestId={selectedRequestId} 
          onClose={() => setSelectedRequestId(null)} 
        />
      )}
    </div>
  );
};
