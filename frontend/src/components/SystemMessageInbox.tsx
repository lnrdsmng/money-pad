import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import http from '../api/http';
import { useAuth } from '../auth/AuthProvider';
import { Pin, Mail, MailOpen, LoaderCircle, Sparkles } from 'lucide-react';
import { WithdrawalFlowModal } from './WithdrawalFlowModal';
import { useFeedback } from './feedback/feedback';
import { getApiErrorMessage } from '../utils/apiError';

export const SystemMessageInbox = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const feedback = useFeedback();

  const { data: messages, isLoading } = useQuery({
    queryKey: ['systemMessages', user?.id],
    queryFn: async () => {
      const res = await http.get(`/users/${user?.id}/system-messages`);
      return res.data;
    },
    enabled: !!user?.id,
  });

  const readMutation = useMutation({
    mutationFn: (id: string) => http.put(`/system-messages/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['systemMessages', user?.id] }),
    onError: (error) => feedback.error(getApiErrorMessage(error, 'The message could not be marked as read.')),
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
            className={`p-4 transition-colors ${msg.is_read ? 'bg-white' : 'bg-blue-50/50'} ${
              msg.is_pinned ? 'border-l-4 border-l-primary' : ''
            }`}
            aria-busy={readMutation.isPending && readMutation.variables === msg.id}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                {readMutation.isPending && readMutation.variables === msg.id ? (
                  <LoaderCircle className="mt-1 h-5 w-5 shrink-0 animate-spin text-blue-500" />
                ) : msg.is_pinned ? (
                  <Pin className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                ) : msg.is_read ? (
                  <MailOpen className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                ) : (
                  <Mail className="w-5 h-5 text-blue-500 mt-1 flex-shrink-0" />
                )}

                <div>
                  <h4
                    className={`text-sm ${
                      msg.is_read ? 'font-medium text-gray-700' : 'font-bold text-gray-900'
                    }`}
                  >
                    {msg.title}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">{msg.content}</p>

                  {msg.action_type === 'watch_ads_prompt' && msg.withdrawal_request_id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRequestId(msg.withdrawal_request_id);
                      }}
                      className="mt-3 px-3.5 py-1.5 bg-primary text-white rounded-md text-xs font-semibold hover:bg-primary-dark transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      View Payout & Waive Fee
                    </button>
                  )}
                </div>
              </div>
              <div className="ml-4 flex shrink-0 flex-col items-end gap-2">
                <span className="whitespace-nowrap text-xs text-gray-400">
                  {new Date(msg.created_at).toLocaleDateString()}
                </span>
                {!msg.is_read && (
                  <button
                    type="button"
                    disabled={readMutation.isPending}
                    aria-busy={readMutation.isPending && readMutation.variables === msg.id}
                    onClick={() => readMutation.mutate(msg.id)}
                    className="text-xs font-semibold text-blue-700 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {readMutation.isPending && readMutation.variables === msg.id
                      ? 'Marking...'
                      : 'Mark as read'}
                  </button>
                )}
              </div>
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