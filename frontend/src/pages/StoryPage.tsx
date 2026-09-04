import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { Heart, BookOpen, ArrowRight } from 'lucide-react';
import http from '../api/http';
import { useAuth } from '../auth/AuthProvider';
import { VerifiedBadge } from '../components/common/VerifiedBadge';
import { StoryReviewsSection } from '../components/story/StoryReviewsSection';
import { useFeedback } from '../components/feedback/feedback';

export default function StoryPage() {
  const { storyId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const feedback = useFeedback();

  const { data: story, isLoading: loadingStory } = useQuery({
    queryKey: ['story', storyId],
    queryFn: async () => {
      const response = await http.get(`/stories/${storyId}`);
      return response.data;
    },
    enabled: !!storyId,
  });

  const { data: parts, isLoading: loadingParts } = useQuery({
    queryKey: ['story', storyId, 'parts'],
    queryFn: async () => {
      const response = await http.get(`/stories/${storyId}/parts`);
      return response.data;
    },
    enabled: !!storyId,
  });

  const { data: likeStatus } = useQuery({
    queryKey: ['story', storyId, 'isLiked', user?.id],
    queryFn: async () => {
      const response = await http.get(`/stories/${storyId}/is-liked`, {
        params: { userId: user?.id },
      });
      return response.data;
    },
    enabled: !!storyId && !!user?.id,
  });

  const isLiked = Boolean(likeStatus?.isLiked);
  const likesCount = Number(story?.likes ?? 0);

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Please log in to like stories');
      const res = await http.post(`/stories/${storyId}/like`, { userId: user.id });
      return res.data;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['story', storyId] });
      await queryClient.cancelQueries({ queryKey: ['story', storyId, 'isLiked', user?.id] });

      const prevStory = queryClient.getQueryData<any>(['story', storyId]);
      const prevLikeStatus = queryClient.getQueryData<{ isLiked: boolean }>(['story', storyId, 'isLiked', user?.id]);

      const wasLiked = Boolean(prevLikeStatus?.isLiked);
      queryClient.setQueryData(['story', storyId, 'isLiked', user?.id], { isLiked: !wasLiked });
      if (prevStory) {
        queryClient.setQueryData(['story', storyId], {
          ...prevStory,
          likes: wasLiked ? Math.max(0, (Number(prevStory.likes) || 0) - 1) : (Number(prevStory.likes) || 0) + 1,
        });
      }

      return { prevStory, prevLikeStatus };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevStory) {
        queryClient.setQueryData(['story', storyId], context.prevStory);
      }
      if (context?.prevLikeStatus) {
        queryClient.setQueryData(['story', storyId, 'isLiked', user?.id], context.prevLikeStatus);
      }
      feedback.error('Could not update like status');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['story', storyId] });
      queryClient.invalidateQueries({ queryKey: ['story', storyId, 'isLiked', user?.id] });
    },
  });

  const handleLikeClick = () => {
    if (!user) {
      feedback.info('Please log in to like this story.');
      return;
    }
    likeMutation.mutate();
  };

  if (loadingStory || loadingParts) return <div className="text-center p-8">Loading...</div>;
  if (!story) return <div className="text-center p-8 text-accent">Story not found</div>;

  const firstPart = parts?.[0];

  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-gray-200 dark:border-slate-800 overflow-hidden mt-4 p-4 sm:p-6">
      <div className="md:flex gap-6">
        <div className="md:w-1/3 bg-gray-100 dark:bg-slate-800 rounded-xl overflow-hidden shrink-0">
          {story.coverImageUrl ? (
            <img src={story.coverImageUrl} alt={story.title} className="w-full h-auto object-cover aspect-[2/3]" />
          ) : (
            <div className="w-full aspect-[2/3] flex items-center justify-center text-gray-400">No Cover</div>
          )}
        </div>
        <div className="mt-4 md:mt-0 md:w-2/3 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start gap-2 mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 min-w-0 break-words">{story.title}</h1>
              {story.isMature && <span className="bg-accent text-white px-2 py-0.5 sm:py-1 text-xs font-bold rounded shrink-0">Mature</span>}
            </div>
            
            <div className="flex items-center gap-1.5 text-base sm:text-lg text-gray-600 dark:text-gray-300 mb-3 sm:mb-4">
              <span>By</span>
              <Link to={`/profile/${story.authorName}`} className="font-medium hover:underline text-primary">
                {story.authorName}
              </Link>
              {story.isAuthorVerified && <VerifiedBadge size={16} showText />}
            </div>
            
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500 mb-5">
              <span className="px-2.5 py-1 bg-gray-100 dark:bg-slate-800 rounded-full font-medium">👁 {story.readCount} Reads</span>
              <button
                type="button"
                onClick={handleLikeClick}
                disabled={likeMutation.isPending}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-medium border transition-colors cursor-pointer ${
                  isLiked
                    ? 'bg-rose-50 border-rose-300 text-rose-600 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-400'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-300'
                }`}
                title={isLiked ? 'Unlike story' : 'Like story'}
              >
                <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isLiked ? 'fill-rose-500 text-rose-500' : 'text-gray-400'}`} />
                <span>{likesCount} {likesCount === 1 ? 'Like' : 'Likes'}</span>
              </button>
              <span className="px-2.5 py-1 bg-gray-100 dark:bg-slate-800 rounded-full font-medium">{story.isCompleted ? 'Completed' : 'Ongoing'}</span>
            </div>

            {/* Focal Hero Reading CTA */}
            {firstPart && (
              <div className="mb-6">
                <Link
                  to={`/story/${story.id}/read/${firstPart.id}`}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold text-sm sm:text-base shadow-sm active:scale-98 transition cursor-pointer w-full sm:w-auto"
                >
                  <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Start Reading Chapter 1</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}

            <div className="mb-6">
              <h3 className="font-semibold mb-2 text-base sm:text-lg text-gray-900 dark:text-gray-100">Synopsis</h3>
              <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{story.overview}</p>
            </div>

            <div className="flex flex-wrap gap-2 mb-8">
              {story.genres?.split(',').map((g: string) => (
                <span key={g} className="px-3 py-1 bg-[#F5E9DA] text-stone-800 dark:bg-amber-950/40 dark:text-amber-200 border border-amber-200/80 dark:border-amber-900/40 rounded-full text-xs font-medium">
                  {g.trim()}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3 sm:mb-4 text-lg sm:text-xl text-gray-900 dark:text-gray-100">Table of Contents</h3>
            {parts?.length > 0 ? (
              <ul className="space-y-2">
                {parts.map((part: any, index: number) => (
                  <li key={part.id}>
                    <Link 
                      to={`/story/${story.id}/read/${part.id}`}
                      className="flex justify-between items-center gap-2 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition border border-gray-100 dark:border-slate-800"
                    >
                      <span className="text-sm sm:text-base font-medium min-w-0 truncate text-gray-900 dark:text-gray-100">Part {index + 1}: {part.title}</span>
                      <span className="text-gray-400 text-xs sm:text-sm shrink-0 whitespace-nowrap">👁 {part.readCount}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">No chapters published yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <StoryReviewsSection storyId={story.id} storyTitle={story.title} />
    </div>
  );
}
