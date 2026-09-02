import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import http from '../../api/http';
import { useFeedback } from '../../components/feedback/feedback';
import { getApiErrorMessage } from '../../utils/apiError';

export const MessagingPanel = () => {
  const [target, setTarget] = useState('all'); // 'all' or userId
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const feedback = useFeedback();

  const { data: users } = useQuery({
    queryKey: ['admin', 'users', 'list'],
    queryFn: async () => {
      const res = await http.get('/admin/users');
      return res.data;
    }
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (target === 'all') {
        return http.post('/admin/messages/broadcast', { title, content });
      } else {
        return http.post('/admin/messages/send', { userId: target, title, content, is_pinned: isPinned });
      }
    },
    onSuccess: () => {
      if (target === 'all') {
        feedback.info('Broadcast queued (simulated MVP behavior).');
      } else {
        feedback.success('Message sent.');
      }
      setTitle('');
      setContent('');
    },
    onError: (error) => feedback.error(getApiErrorMessage(error, 'The message could not be sent.')),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;
    sendMutation.mutate();
  };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">System Messaging</h1>
      
      <div className="bg-white shadow rounded-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary"
            >
              <option value="all">Broadcast to All Users</option>
              {users?.map((u: any) => (
                <option key={u.id} value={u.id}>Specific: {u.username}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary"
              required
            />
          </div>

          {target !== 'all' && (
            <div className="flex items-center">
              <input
                id="pin"
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <label htmlFor="pin" className="ml-2 block text-sm text-gray-900">
                Pin message to top of user's inbox
              </label>
            </div>
          )}

          <div className="pt-4">
            <button
              type="submit"
              disabled={sendMutation.isPending}
              aria-busy={sendMutation.isPending}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
            >
              {sendMutation.isPending ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
