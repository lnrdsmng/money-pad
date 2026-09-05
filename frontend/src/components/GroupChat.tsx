import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import http from '../api/http';
import { useAuth } from '../auth/AuthProvider';
import { Send, MessageCircle, LoaderCircle, Shield } from 'lucide-react';
import { useFeedback } from './feedback/feedback';
import { getApiErrorMessage } from '../utils/apiError';

export const GroupChat = () => {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const feedback = useFeedback();

  const { data: messages, refetch } = useQuery({
    queryKey: ['groupChat'],
    queryFn: async () => {
      const res = await http.get('/chat/messages');
      return res.data;
    },
    enabled: !!user,
    refetchInterval: 3000,
    refetchIntervalInBackground: false, // Stops polling when tab/window is inactive
  });

  const sendMutation = useMutation({
    mutationFn: (msg: string) => http.post('/chat/messages', { message: msg }),
    onSuccess: () => {
      setMessage('');
      refetch();
    },
    onError: (error) => feedback.error(getApiErrorMessage(error, 'Your message could not be sent.')),
  });

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    sendMutation.mutate(message);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-gray-200 dark:border-slate-800 flex flex-col h-[500px] sm:h-[650px] overflow-hidden">
      <div className="border-b border-gray-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 sm:py-4 bg-[#F5E9DA]/30 dark:bg-slate-800/40 flex items-center justify-between">
        <div className="flex items-center">
          <MessageCircle className="w-5 h-5 mr-2 text-primary" />
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">Community Chat</h3>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Live
        </span>
      </div>
      
      <div ref={messagesContainerRef} className="flex-1 p-3 sm:p-5 overflow-y-auto bg-[#FAF9F6]/50 dark:bg-slate-950/40 space-y-3 sm:space-y-4">
        {messages?.map((msg: any) => {
          const isMe = msg.userId === user?.id;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-3.5 sm:px-4 py-2.5 shadow-xs ${
                  msg.is_system
                    ? 'bg-[#F5E9DA] border border-amber-300/70 text-stone-900 dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-100'
                    : isMe
                    ? 'bg-primary text-white rounded-br-xs'
                    : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-gray-100 rounded-bl-xs'
                }`}
              >
                {!isMe && (
                  <p
                    className={`text-xs font-bold mb-1 flex items-center gap-1 ${
                      msg.is_system ? 'text-amber-900 dark:text-amber-200' : 'text-primary'
                    }`}
                  >
                    {msg.is_system && <Shield className="w-3.5 h-3.5" />}
                    {msg.is_system ? 'Admin Notice' : `@${msg.username}`}
                  </p>
                )}
                <p className={`text-xs sm:text-sm leading-relaxed ${isMe ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>{msg.message}</p>
                <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-green-100' : 'text-gray-400 dark:text-gray-500'}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-gray-200 dark:border-slate-800 p-3 sm:p-4 bg-white dark:bg-slate-900">
        <form onSubmit={handleSubmit} className="flex items-center space-x-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 dark:text-gray-100 rounded-full px-4 py-2.5 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-xs sm:text-sm"
          />
          <button 
            type="submit" 
            disabled={!message.trim() || sendMutation.isPending}
            aria-busy={sendMutation.isPending}
            aria-label={sendMutation.isPending ? 'Sending message' : 'Send message'}
            className="bg-primary hover:bg-primary-hover active:scale-95 text-white p-2.5 rounded-full disabled:cursor-not-allowed disabled:opacity-50 transition shadow-xs cursor-pointer shrink-0"
          >
            {sendMutation.isPending ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Send className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        </form>
      </div>
    </div>
  );
};

