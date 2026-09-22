import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import http from '../../api/http';
import { useFeedback } from '../../components/feedback/feedback';
import { getApiErrorMessage } from '../../utils/apiError';

interface UserSearchResult {
  id: string;
  username: string;
  email: string;
}

export const MessagingPanel = () => {
  const [targetType, setTargetType] = useState<'all' | 'user'>('all');
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const feedback = useFeedback();

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const usersQuery = useQuery<UserSearchResult[]>({
    queryKey: ['admin', 'users', 'search', debouncedSearch],
    queryFn: async ({ signal }) => (
      await http.get('/admin/users/search', { params: { query: debouncedSearch }, signal })
    ).data.data,
    enabled: targetType === 'user' && !selectedUser && debouncedSearch.length >= 2,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (targetType === 'all') return http.post('/admin/messages/broadcast', { title, content });
      return http.post('/admin/messages/send', {
        userId: selectedUser?.id,
        title,
        content,
        is_pinned: isPinned,
      });
    },
    onSuccess: () => {
      if (targetType === 'all') feedback.info('Broadcast queued (simulated MVP behavior).');
      else feedback.success('Message sent.');
      setTitle('');
      setContent('');
    },
    onError: (error) => feedback.error(getApiErrorMessage(error, 'The message could not be sent.')),
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !content.trim() || (targetType === 'user' && !selectedUser)) return;
    sendMutation.mutate();
  };

  const selectUser = (user: UserSearchResult) => {
    setSelectedUser(user);
    setSearch('');
    setDebouncedSearch('');
  };

  return (
    <div className="max-w-2xl p-4 sm:p-6 lg:p-8">
      <h1 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100 sm:mb-6 sm:text-2xl">System Messaging</h1>
      <div className="rounded-lg border border-gray-100 bg-white p-4 shadow dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Target</legend>
            <div className="flex flex-wrap gap-4 text-sm text-gray-900 dark:text-gray-100">
              <label className="flex items-center gap-2">
                <input type="radio" checked={targetType === 'all'} onChange={() => setTargetType('all')} />
                Broadcast to all users
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={targetType === 'user'} onChange={() => setTargetType('user')} />
                Specific user
              </label>
            </div>
          </fieldset>

          {targetType === 'user' && (
            <div>
              <label htmlFor="message-user-search" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
              {selectedUser ? (
                <div className="flex items-center justify-between rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{selectedUser.username}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{selectedUser.email}</p>
                  </div>
                  <button type="button" onClick={() => setSelectedUser(null)} aria-label="Clear selected user" className="rounded p-1 text-gray-500 hover:bg-black/5 dark:hover:bg-white/10">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    id="message-user-search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Type at least 2 characters"
                    autoComplete="off"
                    className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100"
                  />
                  {debouncedSearch.length >= 2 && (
                    <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                      {usersQuery.isLoading && <p className="p-3 text-sm text-gray-500">Searching...</p>}
                      {usersQuery.isError && <p role="alert" className="p-3 text-sm text-red-600">Users could not be searched.</p>}
                      {usersQuery.data?.map((user) => (
                        <button key={user.id} type="button" onClick={() => selectUser(user)} className="block w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-slate-700">
                          <span className="block font-medium text-gray-900 dark:text-gray-100">{user.username}</span>
                          <span className="block text-xs text-gray-500 dark:text-gray-400">{user.email}</span>
                        </button>
                      ))}
                      {!usersQuery.isLoading && usersQuery.data?.length === 0 && <p className="p-3 text-sm text-gray-500">No matching users.</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label htmlFor="message-title" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
            <input id="message-title" value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100" required />
          </div>
          <div>
            <label htmlFor="message-content" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Message Content</label>
            <textarea id="message-content" value={content} onChange={(event) => setContent(event.target.value)} rows={5} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100" required />
          </div>
          {targetType === 'user' && (
            <label className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-200">
              <input type="checkbox" checked={isPinned} onChange={(event) => setIsPinned(event.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-slate-600" />
              Pin message to top of user's inbox
            </label>
          )}
          <div className="pt-4">
            <button type="submit" disabled={sendMutation.isPending || (targetType === 'user' && !selectedUser)} aria-busy={sendMutation.isPending} className="flex w-full justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
              {sendMutation.isPending ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
