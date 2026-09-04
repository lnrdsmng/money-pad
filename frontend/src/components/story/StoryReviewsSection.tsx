import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Star, MessageSquarePlus } from 'lucide-react';
import http from '../../api/http';
import { useAuth } from '../../auth/AuthProvider';
import { VerifiedBadge } from '../common/VerifiedBadge';
import { ReviewModal } from './ReviewModal';

interface StoryReviewsSectionProps {
  storyId: string;
  storyTitle: string;
}

export const StoryReviewsSection = ({ storyId, storyTitle }: StoryReviewsSectionProps) => {
  const { user } = useAuth();
  const [showReviewModal, setShowReviewModal] = useState(false);

  const { data: reviews = [], isLoading, refetch } = useQuery({
    queryKey: ['story', storyId, 'reviews'],
    queryFn: async () => {
      const res = await http.get(`/stories/${storyId}/reviews`);
      return res.data;
    },
    enabled: !!storyId,
  });

  const { data: hasReviewedData } = useQuery({
    queryKey: ['story', storyId, 'hasReviewed', user?.id],
    queryFn: async () => {
      const res = await http.get(`/stories/${storyId}/reviews/has-reviewed?userId=${user?.id}`);
      return res.data;
    },
    enabled: !!storyId && !!user?.id,
  });

  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0
    ? (reviews.reduce((acc: number, r: any) => acc + (Number(r.rating) || 0), 0) / totalReviews).toFixed(1)
    : '0.0';

  const distribution = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r: any) => Number(r.rating) === star).length;
    const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
    return { star, count, percentage };
  });

  return (
    <div className="mt-8 border-t border-gray-200 dark:border-slate-700 pt-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            Ratings & Reviews
            <span className="text-sm font-normal text-gray-500">({totalReviews})</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Real opinions from readers who completed chapters</p>
        </div>

        {user && !hasReviewedData?.hasReviewed && (
          <button
            onClick={() => setShowReviewModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-green-600 transition text-sm font-medium shadow-xs"
          >
            <MessageSquarePlus className="w-4 h-4" />
            Write a Review
          </button>
        )}
      </div>

      {/* Ratings Summary Card */}
      <div className="bg-gray-50 dark:bg-slate-900/50 rounded-xl p-4 sm:p-6 mb-6 border border-gray-100 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
        <div className="text-center sm:border-r border-gray-200 dark:border-slate-700 sm:pr-6">
          <div className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-gray-100">{averageRating}</div>
          <div className="flex justify-center items-center gap-1 my-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-4 h-4 ${
                  star <= Math.round(Number(averageRating))
                    ? 'text-amber-400 fill-amber-400'
                    : 'text-gray-300 dark:text-slate-600'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-gray-500">{totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}</p>
        </div>

        <div className="sm:col-span-2 space-y-1.5">
          {distribution.map(({ star, count, percentage }) => (
            <div key={star} className="flex items-center gap-2 text-xs">
              <span className="w-8 text-right font-medium text-gray-600 dark:text-gray-400">{star} ★</span>
              <div className="flex-1 h-2.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="w-8 text-left text-gray-400">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reviews List */}
      {isLoading ? (
        <div className="text-center py-8 text-sm text-gray-500">Loading reviews...</div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-500 bg-white dark:bg-slate-800 rounded-lg border border-dashed border-gray-200 dark:border-slate-700">
          No reviews yet. Be the first to share your thoughts!
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review: any) => (
            <div
              key={review.id}
              className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-100 dark:border-slate-700 shadow-xs"
            >
              <div className="flex justify-between items-start gap-3 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase overflow-hidden shrink-0">
                    {review.userProfileImageUrl ? (
                      <img src={review.userProfileImageUrl} alt={review.username} className="w-full h-full object-cover" />
                    ) : (
                      review.username?.[0] || 'U'
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                        {review.username}
                      </span>
                      {review.isUserVerified && <VerifiedBadge size={13} />}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3 h-3 ${
                            star <= Number(review.rating)
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-gray-300 dark:text-slate-600'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <span className="text-[11px] text-gray-400 shrink-0">
                  {review.timestamp ? new Date(Number(review.timestamp)).toLocaleDateString() : 'Recently'}
                </span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap pl-10">
                {review.comment}
              </p>
            </div>
          ))}
        </div>
      )}

      {showReviewModal && (
        <ReviewModal
          storyId={storyId}
          storyTitle={storyTitle}
          onClose={() => setShowReviewModal(false)}
          onReviewSubmitted={() => refetch()}
        />
      )}
    </div>
  );
};

export default StoryReviewsSection;
