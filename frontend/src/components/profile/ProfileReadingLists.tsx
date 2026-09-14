import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookMarked, BookOpen, LoaderCircle, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import http from '../../api/http';
import type { ReadingList } from '../../types/readingLists';
import { ActionDialog } from '../feedback/ActionDialog';
import { useFeedback } from '../feedback/feedback';

interface ProfileReadingListsProps {
  profileUserId: string;
  isOwnProfile: boolean;
}

export function ProfileReadingLists({ profileUserId, isOwnProfile }: ProfileReadingListsProps) {
  const feedback = useFeedback();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');

  const queryKey = ['readingLists', profileUserId];
  const { data: lists = [], isLoading } = useQuery<ReadingList[]>({
    queryKey,
    queryFn: async () => (await http.get(`/users/${profileUserId}/reading-lists`)).data,
    enabled: Boolean(profileUserId),
  });

  const createMutation = useMutation({
    mutationFn: async () => http.post('/reading-lists', { name: name.trim() }),
    onSuccess: async () => {
      setName('');
      setShowCreate(false);
      await queryClient.invalidateQueries({ queryKey });
      feedback.success('Reading list created.');
    },
    onError: () => feedback.error('Could not create the reading list.'),
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><LoaderCircle className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-5">
      {isOwnProfile && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-green-600"
          >
            <Plus className="h-4 w-4" /> New reading list
          </button>
        </div>
      )}

      {lists.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white py-12 text-center shadow-xs dark:border-slate-700 dark:bg-slate-800">
          <BookMarked className="mx-auto mb-2 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500">
            {isOwnProfile ? 'Create a reading list to save stories.' : 'This user has no reading lists yet.'}
          </p>
        </div>
      ) : lists.map((list) => (
        <section key={list.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-xs dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-gray-900 dark:text-gray-100">{list.name}</h3>
              <p className="text-xs text-gray-500">{list.storyCount} {list.storyCount === 1 ? 'story' : 'stories'}</p>
            </div>
            <BookMarked className="h-5 w-5 text-primary" />
          </div>
          {list.stories.length === 0 ? (
            <p className="rounded-lg bg-gray-50 py-6 text-center text-xs text-gray-500 dark:bg-slate-900/50">This list is empty.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {list.stories.map((story) => (
                <Link key={story.id} to={`/story/${story.id}`} className="group min-w-0">
                  <div className="aspect-[2/3] overflow-hidden rounded-lg bg-gray-100 dark:bg-slate-700">
                    {story.coverImageUrl ? (
                      <img src={story.coverImageUrl} alt={story.title} className="h-full w-full object-cover transition group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center"><BookOpen className="h-6 w-6 text-gray-400" /></div>
                    )}
                  </div>
                  <p className="mt-1.5 truncate text-xs font-semibold text-gray-800 group-hover:text-primary dark:text-gray-100">{story.title}</p>
                </Link>
              ))}
            </div>
          )}
        </section>
      ))}

      <ActionDialog
        open={showCreate}
        title="Create reading list"
        description="Give this collection a name. It will be visible on your public profile."
        confirmLabel="Create list"
        isPending={createMutation.isPending}
        onCancel={() => { setShowCreate(false); setName(''); }}
        onConfirm={() => createMutation.mutate()}
        input={{ label: 'List name', value: name, onChange: setName, maxLength: 100, required: true, placeholder: 'Favorites' }}
      />
    </div>
  );
}
