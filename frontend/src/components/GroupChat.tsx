import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import http from '../api/http';
import { useAuth } from '../auth/AuthProvider';
import { Send, MessageCircle, LoaderCircle } from 'lucide-react';
import { useFeedback } from './feedback/feedback';
import { getApiErrorMessage } from '../utils/apiError';

export const GroupChat = () => {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const feedback = useFeedback();

  const { data: messages, refetch } = useQuery({
    queryKey: ['groupChat'],
    queryFn: async () => {
      const res = await http.get('/chat/messages');
      return res.data;
    },
    refetchInterval: 3000 // Poll every 3 seconds for MVP
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    sendMutation.mutate(message);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-[600px]">
      <div className="border-b border-gray-100 px-6 py-4 bg-gray-50 flex items-center">
        <MessageCircle className="w-5 h-5 mr-2 text-gray-500" />
        <h3 className="text-lg font-medium text-gray-900">Community Chat</h3>
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto bg-gray-50/50 space-y-4">
        {messages?.map((msg: any) => {
          const isMe = msg.userId === user?.id;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-lg px-4 py-2 shadow-sm ${
                msg.is_system ? 'bg-orange-100 border border-orange-200' : 
                isMe ? 'bg-primary text-white' : 'bg-white border border-gray-200'
              }`}>
                {!isMe && (
                  <p className={`text-xs font-bold mb-1 ${msg.is_system ? 'text-orange-800' : 'text-gray-500'}`}>
                    {msg.is_system ? '🛡️ Admin' : msg.username}
                  </p>
                )}
                <p className={`text-sm ${isMe ? 'text-white' : 'text-gray-800'}`}>{msg.message}</p>
                <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-green-100' : 'text-gray-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200 p-4 bg-white">
        <form onSubmit={handleSubmit} className="flex items-center space-x-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"
          />
          <button 
            type="submit" 
            disabled={!message.trim() || sendMutation.isPending}
            aria-busy={sendMutation.isPending}
            aria-label={sendMutation.isPending ? 'Sending message' : 'Send message'}
            className="bg-primary text-white p-2 rounded-full hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            {sendMutation.isPending ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </form>
      </div>
    </div>
  );
};
