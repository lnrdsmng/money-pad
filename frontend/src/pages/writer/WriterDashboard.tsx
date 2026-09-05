import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ShieldCheck, BookOpen, ArrowRight, Trash2, Eye, Star } from 'lucide-react';
import http from '../../api/http';
import { useAuth } from '../../auth/AuthProvider';
import { CreateStoryModal } from '../../components/writer/CreateStoryModal';
import { VerifiedBadge } from '../../components/common/VerifiedBadge';
import { ActionDialog } from '../../components/feedback/ActionDialog';
import { useFeedback } from '../../components/feedback/feedback';
import { getApiErrorMessage } from '../../utils/apiError';

export default function WriterDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const feedback = useFeedback();
  const [activeTab, setActiveTab] = useState<'published' | 'drafts'>('published');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [storyToDelete, setStoryToDelete] = useState<any | null>(null);

  const { data: stories, isLoading } = useQuery({
    queryKey: ['stories', 'author', user?.id, activeTab],
    queryFn: async () => {
      const response = await http.get(`/authors/${user?.id}/stories/${activeTab}`);
      return response.data;
    },
    enabled: !!user,
  });

  const deleteStoryMutation = useMutation({
    mutationFn: async (storyId: string) => {
      await http.delete(`/stories/${storyId}`);
    },
    onSuccess: () => {
      setStoryToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      feedback.success('Story deleted.');
    },
    onError: (error) => feedback.error(getApiErrorMessage(error, 'The story could not be deleted.')),
  });

  const handleCreateNew = () => {
    setShowCreateModal(true);
  };

  if (!user) return <div className="p-8 text-center">Please login</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Writer Studio</h1>
            {user.isVerified && <VerifiedBadge size={22} />}
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Manage your books, chapters, and author status</p>
        </div>

        <button 
          onClick={handleCreateNew}
          className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-bold text-xs sm:text-sm text-white transition hover:bg-green-600 shadow-sm cursor-pointer"
        >
          + Create New Story
        </button>
      </div>

      {/* AUTHOR VERIFICATION CALLOUT */}
      {!user.isVerified && (
        <div className="bg-[#F5E9DA]/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-primary text-white rounded-xl shrink-0 mt-0.5 shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-amber-100 flex items-center gap-1.5">
                Get Verified as an Official Author
                <VerifiedBadge size={16} />
              </h2>
              <p className="text-xs text-stone-600 dark:text-stone-300 mt-0.5">
                Unlock ₱20 minimum withdrawals, $0.05 / 100 views payout rates, and priority ranking across discovery.
              </p>
            </div>
          </div>

          <Link
            to="/writer/verification"
            className="px-4 py-2 bg-primary hover:bg-primary-hover active:scale-98 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
          >
            <span>Learn More & Apply</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200 dark:border-slate-700">
        <button 
          className={`pb-3 font-semibold border-b-2 text-xs sm:text-sm transition cursor-pointer ${activeTab === 'published' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          onClick={() => setActiveTab('published')}
        >
          Published Works
        </button>
        <button 
          className={`pb-3 font-semibold border-b-2 text-xs sm:text-sm transition cursor-pointer ${activeTab === 'drafts' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          onClick={() => setActiveTab('drafts')}
        >
          Drafts
        </button>
      </div>

      {isLoading ? (
        <div className="text-center p-8 text-sm text-gray-500">Loading stories...</div>
      ) : stories?.length === 0 ? (
        <div className="text-center p-8 sm:p-12 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700">
          <BookOpen className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">You have no {activeTab} stories yet.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
          {stories?.map((story: any) => (
            <div key={story.id} className="flex flex-col xs:flex-row border border-gray-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-white dark:bg-slate-800 shadow-xs hover:border-gray-300 transition-colors">
              <div className="xs:w-1/3 w-full h-36 xs:h-auto bg-gray-100 dark:bg-slate-700 shrink-0">
                {story.coverImageUrl ? (
                  <img src={story.coverImageUrl} alt={story.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs text-center p-2">No Cover</div>
                )}
              </div>
              <div className="xs:w-2/3 w-full p-4 flex flex-col justify-between min-w-0">
                <div>
                  <h3 className="font-bold text-base mb-1 line-clamp-1 text-gray-900 dark:text-gray-100">{story.title}</h3>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-2">{story.overview}</p>
                  <div className="flex items-center gap-2 text-[11px] text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {story.readCount} Reads
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      {story.likes} Likes
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
                  <Link to={`/writer/story/${story.id}`} className="text-primary font-semibold hover:underline">
                    Edit Details
                  </Link>
                  <span className="text-gray-300 dark:text-slate-700">|</span>
                  <Link to={`/writer/story/${story.id}/parts`} className="text-primary font-semibold hover:underline">
                    Manage Chapters
                  </Link>
                  <span className="text-gray-300 dark:text-slate-700">|</span>
                  <button
                    type="button"
                    onClick={() => setStoryToDelete(story)}
                    className="inline-flex items-center gap-1 text-red-500 font-semibold hover:underline cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateStoryModal onClose={() => setShowCreateModal(false)} />
      )}

      <ActionDialog
        open={Boolean(storyToDelete)}
        title="Delete story?"
        description={`“${storyToDelete?.title ?? 'This story'}” and all its chapters will be permanently deleted. This action cannot be undone.`}
        confirmLabel="Delete story"
        pendingLabel="Deleting..."
        tone="danger"
        isPending={deleteStoryMutation.isPending}
        onCancel={() => {
          if (!deleteStoryMutation.isPending) setStoryToDelete(null);
        }}
        onConfirm={() => {
          if (storyToDelete) deleteStoryMutation.mutate(storyToDelete.id);
        }}
      />
    </div>
  );
}
