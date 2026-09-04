import { useState } from 'react';
import { Star, X } from 'lucide-react';
import http from '../../api/http';
import { useAuth } from '../../auth/AuthProvider';
import { useFeedback } from '../feedback/feedback';
import { getApiErrorMessage } from '../../utils/apiError';

interface ReviewModalProps {
  storyId: string;
  storyTitle: string;
  onClose: () => void;
  onReviewSubmitted: () => void;
}

export const ReviewModal = ({ storyId, storyTitle, onClose, onReviewSubmitted }: ReviewModalProps) => {
  const { user } = useAuth();
  const feedback = useFeedback();
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      feedback.error('Please log in to submit a review.');
      return;
    }
    if (rating < 1 || rating > 5) {
      feedback.error('Please select a star rating between 1 and 5.');
      return;
    }
    if (!comment.trim()) {
      feedback.error('Please write a comment for your review.');
      return;
    }

    setIsSubmitting(true);
    try {
      await http.post(`/stories/${storyId}/reviews`, {
        userId: user.id,
        rating,
        comment: comment.trim(),
      });
      feedback.success('Thank you! Your review has been posted.');
      onReviewSubmitted();
      onClose();
    } catch (error) {
      feedback.error(getApiErrorMessage(error, 'Could not post your review.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 relative animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">Write a Review</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 line-clamp-1">{storyTitle}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Rating
            </label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 focus:outline-none transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-7 h-7 ${
                      star <= (hoverRating || rating)
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-gray-300 dark:text-slate-600'
                    }`}
                  />
                </button>
              ))}
              <span className="ml-2 text-sm font-bold text-gray-700 dark:text-gray-300">
                {hoverRating || rating} / 5
              </span>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Your Thoughts
              </label>
              <span className="text-xs text-gray-400">{comment.length} / 500</span>
            </div>
            <textarea
              rows={4}
              maxLength={500}
              required
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What did you love about this story? What made it memorable?"
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-3 text-sm text-gray-900 dark:text-gray-100 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !comment.trim()}
              className="px-5 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-green-600 transition disabled:opacity-60 disabled:cursor-not-allowed shadow-xs"
            >
              {isSubmitting ? 'Submitting...' : 'Post Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReviewModal;
