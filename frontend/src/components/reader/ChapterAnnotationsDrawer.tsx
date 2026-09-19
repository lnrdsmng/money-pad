import { useEffect, useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, LoaderCircle, MessageSquare, Reply, Send, X } from 'lucide-react';
import http from '../../api/http';
import { useAuth } from '../../auth/AuthProvider';
import type { PaginatedPassageComments, ParagraphAnchor, PassageComment } from '../../types/annotations';
import { VerifiedBadge } from '../common/VerifiedBadge';
import { useFeedback } from '../feedback/feedback';
import { UserAvatar } from '../common/UserAvatar';

interface ChapterAnnotationsDrawerProps {
  partId: string;
  paragraph: ParagraphAnchor | null;
  onClose: () => void;
}

export const ChapterAnnotationsDrawer = ({ partId, paragraph, onClose }: ChapterAnnotationsDrawerProps) => {
  const { user } = useAuth();
  const feedback = useFeedback();
  const queryClient = useQueryClient();
  const [replyingTo, setReplyingTo] = useState<PassageComment | null>(null);
  const [reply, setReply] = useState('');
  const discussionKey = ['annotations', partId, paragraph?.startIndex, paragraph?.endIndex];

  const commentsQuery = useInfiniteQuery<PaginatedPassageComments>({
    queryKey: discussionKey,
    queryFn: async ({ pageParam }) => {
      const response = await http.get(`/parts/${partId}/annotations`, {
        params: { startIndex: paragraph!.startIndex, endIndex: paragraph!.endIndex, page: pageParam },
      });
      return response.data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (
      lastPage.current_page < lastPage.last_page ? lastPage.current_page + 1 : undefined
    ),
    enabled: Boolean(paragraph),
  });

  const refreshDiscussion = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: discussionKey }),
      queryClient.invalidateQueries({ queryKey: ['annotationSummaries', partId] }),
    ]);
  };

  const replyMutation = useMutation({
    mutationFn: async () => {
      if (!user || !replyingTo) throw new Error('Sign in to reply.');
      await http.post(`/parts/${partId}/annotations`, {
        userId: user.id,
        parentId: replyingTo.id,
        content: reply.trim(),
      });
    },
    onSuccess: async () => {
      setReply('');
      setReplyingTo(null);
      await refreshDiscussion();
    },
    onError: () => feedback.error('Could not post your reply.'),
  });

  const heartMutation = useMutation({
    mutationFn: async (annotationId: string) => {
      if (!user) throw new Error('Sign in to react.');
      await http.post(`/annotations/${annotationId}/heart`);
    },
    onSuccess: refreshDiscussion,
    onError: () => feedback.error('Could not update that reaction.'),
  });

  useEffect(() => {
    if (!paragraph) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, paragraph]);

  if (!paragraph) return null;

  const comments = commentsQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const reactTo = (comment: PassageComment) => {
    if (!user) {
      feedback.info('Please log in to react to comments.');
      return;
    }
    heartMutation.mutate(comment.id);
  };
  const startReply = (comment: PassageComment) => {
    if (!user) {
      feedback.info('Please log in to reply to comments.');
      return;
    }
    setReplyingTo(comment);
  };

  const commentCard = (comment: PassageComment, isReply = false) => (
    <article
      key={comment.id}
      className={`rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-800/70 ${isReply ? 'ml-6 mt-2' : ''}`}
    >
      <div className="flex items-center gap-2">
        <UserAvatar username={comment.username} imageUrl={comment.userProfileImageUrl} className="h-7 w-7 text-xs" />
        <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{comment.username}</span>
        {comment.isUserVerified && <VerifiedBadge size={12} />}
        <time className="ml-auto text-[10px] text-gray-400">
          {new Date(Number(comment.timestamp)).toLocaleDateString()}
        </time>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-gray-700 dark:text-gray-200">
        {comment.content}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => reactTo(comment)}
          disabled={heartMutation.isPending}
          className={`inline-flex items-center gap-1 text-[11px] font-medium ${comment.isHearted ? 'text-rose-500' : 'text-gray-500 hover:text-rose-500'}`}
          aria-label={`${comment.isHearted ? 'Remove heart from' : 'Heart'} ${comment.username}'s comment`}
        >
          <Heart className={`h-3.5 w-3.5 ${comment.isHearted ? 'fill-current' : ''}`} />
          {comment.heartsCount}
        </button>
        {!isReply && (
          <button type="button" onClick={() => startReply(comment)} className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-primary">
            <Reply className="h-3.5 w-3.5" /> Reply
          </button>
        )}
      </div>
      {comment.replies?.map((child) => commentCard(child, true))}
    </article>
  );

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/40 backdrop-blur-xs" onMouseDown={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Paragraph comments"
        onMouseDown={(event) => event.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-slate-900"
      >
        <header className="flex items-center justify-between border-b border-gray-100 p-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="font-bold text-gray-900 dark:text-gray-100">Paragraph comments</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-gray-400 hover:text-gray-700" aria-label="Close comments">
            <X className="h-5 w-5" />
          </button>
        </header>
        <blockquote className="mx-4 mt-4 rounded-r-lg border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-xs italic text-gray-600 dark:bg-amber-950/20 dark:text-gray-300">
          “{paragraph.selectedText}”
        </blockquote>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {commentsQuery.isLoading ? (
            <div className="flex justify-center py-10"><LoaderCircle className="h-5 w-5 animate-spin text-primary" /></div>
          ) : comments.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">No comments on this paragraph yet.</p>
          ) : comments.map((comment) => commentCard(comment))}
          {commentsQuery.hasNextPage && (
            <button
              type="button"
              onClick={() => commentsQuery.fetchNextPage()}
              disabled={commentsQuery.isFetchingNextPage}
              className="w-full rounded-lg border border-gray-200 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-800"
            >
              {commentsQuery.isFetchingNextPage ? 'Loading...' : 'Show more comments'}
            </button>
          )}
        </div>
        {replyingTo && (
          <form
            className="border-t border-gray-100 p-3 dark:border-slate-800"
            onSubmit={(event) => {
              event.preventDefault();
              if (reply.trim()) replyMutation.mutate();
            }}
          >
            <div className="mb-2 flex items-center justify-between text-[11px] text-gray-500">
              <span>Replying to {replyingTo.username}</span>
              <button type="button" onClick={() => setReplyingTo(null)} className="hover:text-gray-800">Cancel</button>
            </div>
            <div className="flex gap-2">
              <input
                autoFocus
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                maxLength={2000}
                placeholder="Write a reply..."
                className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
              <button type="submit" disabled={!reply.trim() || replyMutation.isPending} className="rounded-lg bg-primary p-2.5 text-white disabled:opacity-50" aria-label="Post reply">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        )}
      </aside>
    </div>
  );
};

export default ChapterAnnotationsDrawer;
