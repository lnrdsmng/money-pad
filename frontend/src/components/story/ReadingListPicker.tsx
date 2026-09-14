import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookMarked, Check, LoaderCircle, Plus, X } from 'lucide-react';
import http from '../../api/http';
import type { ReadingList } from '../../types/readingLists';
import { useFeedback } from '../feedback/feedback';

interface ReadingListPickerProps {
  storyId: string;
  userId: string;
  onClose: () => void;
}

export function ReadingListPicker({ storyId, userId, onClose }: ReadingListPickerProps) {
  const feedback = useFeedback();
  const queryClient = useQueryClient();
  const [newListName, setNewListName] = useState('');
  const queryKey = ['readingLists', userId];
  const { data: lists = [], isLoading } = useQuery<ReadingList[]>({
    queryKey,
    queryFn: async () => (await http.get(`/users/${userId}/reading-lists`)).data,
  });

  const saveMutation = useMutation({
    mutationFn: async (listId: string) => http.post(`/reading-lists/${listId}/stories/${storyId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      feedback.success('Story saved to your reading list.');
      onClose();
    },
    onError: () => feedback.error('Could not save this story.'),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await http.post('/reading-lists', { name: newListName.trim() });
      await http.post(`/reading-lists/${response.data.id}/stories/${storyId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      feedback.success('Reading list created and story saved.');
      onClose();
    },
    onError: () => feedback.error('Could not create the reading list.'),
  });

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-3" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Add to reading list" onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookMarked className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Add to reading list</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8"><LoaderCircle className="h-5 w-5 animate-spin text-primary" /></div>
          ) : lists.length === 0 ? (
            <p className="py-3 text-center text-xs text-gray-500">You do not have a reading list yet. Create one below.</p>
          ) : lists.map((list) => {
            const isSaved = list.stories.some((story) => story.id === storyId);
            return (
              <button
                key={list.id}
                type="button"
                onClick={() => !isSaved && saveMutation.mutate(list.id)}
                disabled={isSaved || saveMutation.isPending}
                className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-3 py-3 text-left hover:border-primary hover:bg-primary/5 disabled:cursor-default disabled:opacity-60 dark:border-slate-700"
              >
                <span>
                  <span className="block text-sm font-semibold text-gray-800 dark:text-gray-100">{list.name}</span>
                  <span className="block text-[11px] text-gray-500">{list.storyCount} {list.storyCount === 1 ? 'story' : 'stories'}</span>
                </span>
                {isSaved && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary"><Check className="h-4 w-4" /> Saved</span>}
              </button>
            );
          })}
        </div>

        <form
          className="mt-5 border-t border-gray-100 pt-4 dark:border-slate-700"
          onSubmit={(event) => { event.preventDefault(); if (newListName.trim()) createMutation.mutate(); }}
        >
          <label htmlFor="new-reading-list-name" className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-200">Create a new list</label>
          <div className="flex gap-2">
            <input id="new-reading-list-name" value={newListName} onChange={(event) => setNewListName(event.target.value)} maxLength={100} placeholder="List name" className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-600 dark:bg-slate-900" />
            <button type="submit" disabled={!newListName.trim() || createMutation.isPending} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
              <Plus className="h-4 w-4" /> Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
