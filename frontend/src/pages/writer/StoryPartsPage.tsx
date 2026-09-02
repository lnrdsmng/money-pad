import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import http from '../../api/http';
import { Trash2, Edit, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { ActionDialog } from '../../components/feedback/ActionDialog';
import { useFeedback } from '../../components/feedback/feedback';
import { getApiErrorMessage } from '../../utils/apiError';

export default function StoryPartsPage() {
  const { storyId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [partToDelete, setPartToDelete] = useState<any | null>(null);
  const feedback = useFeedback();

  const { data: story, isLoading: isLoadingStory } = useQuery({
    queryKey: ['story', storyId],
    queryFn: async () => {
      const res = await http.get(`/stories/${storyId}`);
      return res.data;
    },
    enabled: !!storyId
  });

  const { data: parts, isLoading: isLoadingParts } = useQuery({
    queryKey: ['parts', storyId],
    queryFn: async () => {
      const res = await http.get(`/stories/${storyId}/parts`);
      return res.data;
    },
    enabled: !!storyId
  });

  const createPartMutation = useMutation({
    mutationFn: async () => {
      const res = await http.post(`/stories/${storyId}/parts`, {
        title: 'Untitled Chapter',
        content: '<p>Start writing here...</p>',
        isPublished: false
      });
      return res.data;
    },
    onSuccess: (newPart) => {
      queryClient.invalidateQueries({ queryKey: ['parts', storyId] });
      feedback.success('New chapter created.');
      navigate(`/writer/story/${storyId}/read/${newPart.id}/edit`);
    },
    onError: (error) => feedback.error(getApiErrorMessage(error, 'The chapter could not be created.')),
  });

  const deletePartMutation = useMutation({
    mutationFn: async (partId: string) => {
      await http.delete(`/parts/${partId}`);
    },
    onSuccess: () => {
      setPartToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['parts', storyId] });
      feedback.success('Chapter deleted.');
    },
    onError: (error) => feedback.error(getApiErrorMessage(error, 'The chapter could not be deleted.')),
  });

  if (isLoadingStory || isLoadingParts) return <div className="p-8 text-center">Loading chapters...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link to="/writer" className="text-sm text-gray-500 hover:text-primary mb-2 inline-block">&larr; Back to Dashboard</Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Chapters: {story?.title}
          </h1>
        </div>
        <button
          onClick={() => createPartMutation.mutate()}
          disabled={createPartMutation.isPending || deletePartMutation.isPending}
          aria-busy={createPartMutation.isPending}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-green-600 transition"
        >
          {createPartMutation.isPending ? 'Creating...' : '+ New Chapter'}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
        {parts?.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No chapters yet. Click "New Chapter" to get started.
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-slate-700">
            {parts?.map((part: any, index: number) => (
              <li key={part.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-slate-700 rounded-full text-sm font-medium text-gray-500 dark:text-gray-400">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{part.title}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${part.isPublished ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                      {part.isPublished ? 'Published' : 'Draft'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to={`/writer/story/${storyId}/read/${part.id}/edit`}
                    className="p-2 text-gray-500 hover:text-primary transition rounded hover:bg-gray-100 dark:hover:bg-slate-600"
                    title="Edit Chapter"
                  >
                    <Edit size={18} />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setPartToDelete(part)}
                    disabled={deletePartMutation.isPending}
                    aria-label={`Delete ${part.title}`}
                    className="rounded p-2 text-gray-500 transition hover:bg-gray-100 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-600"
                    title="Delete chapter"
                  >
                    {deletePartMutation.isPending && deletePartMutation.variables === part.id ? <LoaderCircle size={18} className="animate-spin" /> : <Trash2 size={18} />}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ActionDialog
        open={Boolean(partToDelete)}
        title="Delete chapter?"
        description={`“${partToDelete?.title ?? 'This chapter'}” will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete chapter"
        pendingLabel="Deleting..."
        tone="danger"
        isPending={deletePartMutation.isPending}
        onCancel={() => {
          if (!deletePartMutation.isPending) setPartToDelete(null);
        }}
        onConfirm={() => {
          if (partToDelete) deletePartMutation.mutate(partToDelete.id);
        }}
      />
    </div>
  );
}
