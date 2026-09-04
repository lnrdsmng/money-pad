import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, MessageSquare, Send, Reply, LoaderCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import http from '../../api/http';
import { useAuth } from '../../auth/AuthProvider';
import { VerifiedBadge } from '../common/VerifiedBadge';
import { useFeedback } from '../feedback/feedback';

interface AuthorWallProps {
  authorId: string;
  authorUsername: string;
}

export const AuthorWall = ({ authorId, authorUsername }: AuthorWallProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const feedback = useFeedback();

  const [message, setMessage] = useState('');
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState<number>(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch top-level conversations
  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations', authorId],
    queryFn: async () => {
      const res = await http.get(`/authors/${authorId}/conversations`);
      return res.data;
    },
    enabled: !!authorId,
  });

  // Fetch user suggestions when typing @
  const { data: userSuggestions = [] } = useQuery({
    queryKey: ['userSuggestions', mentionQuery],
    queryFn: async () => {
      if (!mentionQuery) return [];
      const res = await http.get(`/users/search?query=${encodeURIComponent(mentionQuery)}`);
      return Array.isArray(res.data) ? res.data : res.data.data || [];
    },
    enabled: mentionQuery !== null && mentionQuery.length >= 1,
  });

  // Detect @mention trigger in main textarea
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setMessage(val);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_]*)$/);

    if (match) {
      setMentionQuery(match[1]);
      setMentionIndex(match.index || 0);
    } else {
      setMentionQuery(null);
    }
  };

  const handleSelectMention = (username: string) => {
    if (mentionIndex >= 0) {
      const before = message.slice(0, mentionIndex);
      const after = message.slice(mentionIndex + 1 + (mentionQuery?.length || 0));
      const newMessage = `${before}@${username} ${after}`;
      setMessage(newMessage);
      setMentionQuery(null);
      textareaRef.current?.focus();
    }
  };

  const postMutation = useMutation({
    mutationFn: async ({ msg, parentId }: { msg: string; parentId?: string }) => {
      const res = await http.post('/conversations', {
        authorId,
        message: msg,
        parentId: parentId || null,
      });
      return res.data;
    },
    onSuccess: () => {
      setMessage('');
      setReplyText('');
      setActiveReplyId(null);
      feedback.success('Message posted to wall.');
      queryClient.invalidateQueries({ queryKey: ['conversations', authorId] });
    },
    onError: () => feedback.error('Could not post message.'),
  });

  const likeMutation = useMutation({
    mutationFn: async ({ id, delta }: { id: string; delta: number }) => {
      if (!user) throw new Error('Must be logged in');
      const res = await http.post(`/conversations/${id}/like`, {
        userId: user.id,
        delta,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', authorId] });
    },
  });

  const renderFormattedMessage = (text: string) => {
    const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        const uname = part.slice(1);
        return (
          <Link
            key={index}
            to={`/profile/${uname}`}
            className="text-primary hover:underline font-semibold"
          >
            {part}
          </Link>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Author Wall
          </h3>
          <p className="text-xs text-gray-500">Leave a note, feedback, or say hi to @{authorUsername}</p>
        </div>
      </div>

      {/* Post message input box */}
      {user ? (
        <div className="relative bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700 shadow-xs">
          <textarea
            ref={textareaRef}
            rows={3}
            value={message}
            onChange={handleTextChange}
            placeholder={`Leave a message for @${authorUsername}... Type @ to mention a user`}
            className="w-full text-sm bg-transparent border-none focus:outline-none resize-none text-gray-900 dark:text-gray-100"
          />

          {/* @mention autocomplete popup */}
          {mentionQuery !== null && userSuggestions.length > 0 && (
            <div className="absolute left-4 top-16 z-20 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 py-1 max-h-40 overflow-y-auto">
              {userSuggestions.map((u: any) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleSelectMention(u.username)}
                  className="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center justify-between"
                >
                  <span className="font-medium text-gray-800 dark:text-gray-200">@{u.username}</span>
                  {u.isVerified && <VerifiedBadge size={12} />}
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center border-t border-gray-100 dark:border-slate-700 pt-3 mt-2">
            <span className="text-[11px] text-gray-400">Mention authors or readers with @</span>
            <button
              onClick={() => postMutation.mutate({ msg: message.trim() })}
              disabled={!message.trim() || postMutation.isPending}
              className="px-4 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-green-600 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {postMutation.isPending ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Post
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-xl text-center text-sm text-gray-500 border border-gray-200 dark:border-slate-700">
          <Link to="/login" className="text-primary font-medium hover:underline">Log in</Link> to post on @{authorUsername}'s wall.
        </div>
      )}

      {/* Conversations list */}
      {isLoading ? (
        <div className="text-center py-8 text-sm text-gray-500">Loading wall messages...</div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-10 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 text-gray-500 text-sm">
          The wall is quiet. Start the conversation!
        </div>
      ) : (
        <div className="space-y-4">
          {conversations.map((conv: any) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              authorId={authorId}
              onLike={(delta) => likeMutation.mutate({ id: conv.id, delta })}
              onReply={(text) => postMutation.mutate({ msg: text, parentId: conv.id })}
              formatMessage={renderFormattedMessage}
              isReplying={activeReplyId === conv.id}
              replyText={replyText}
              setReplyText={setReplyText}
              setActiveReplyId={setActiveReplyId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface ConversationItemProps {
  conversation: any;
  authorId: string;
  onLike: (delta: number) => void;
  onReply: (text: string) => void;
  formatMessage: (text: string) => React.ReactNode;
  isReplying: boolean;
  replyText: string;
  setReplyText: (text: string) => void;
  setActiveReplyId: (id: string | null) => void;
}

const ConversationItem = ({
  conversation,
  onLike,
  onReply,
  formatMessage,
  isReplying,
  replyText,
  setReplyText,
  setActiveReplyId,
}: ConversationItemProps) => {
  const { user } = useAuth();
  const [showReplies, setShowReplies] = useState(false);

  const { data: replies = [], refetch: refetchReplies } = useQuery({
    queryKey: ['replies', conversation.id],
    queryFn: async () => {
      const res = await http.get(`/conversations/${conversation.id}/replies`);
      return res.data;
    },
    enabled: showReplies,
  });

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 sm:p-5 border border-gray-100 dark:border-slate-700 shadow-xs">
      <div className="flex items-start gap-3">
        <Link to={`/profile/${conversation.senderName}`} className="shrink-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm uppercase overflow-hidden">
            {conversation.senderProfileImageUrl ? (
              <img src={conversation.senderProfileImageUrl} alt={conversation.senderName} className="w-full h-full object-cover" />
            ) : (
              conversation.senderName?.[0] || 'U'
            )}
          </div>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link
                to={`/profile/${conversation.senderName}`}
                className="font-bold text-sm text-gray-900 dark:text-gray-100 hover:underline"
              >
                @{conversation.senderName}
              </Link>
              {conversation.isSenderVerified && <VerifiedBadge size={13} />}
            </div>
            <span className="text-[11px] text-gray-400 shrink-0">
              {conversation.timestamp ? new Date(Number(conversation.timestamp)).toLocaleDateString() : ''}
            </span>
          </div>

          <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap mb-3">
            {formatMessage(conversation.message)}
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-500">
            <button
              onClick={() => onLike(conversation.isLiked ? -1 : 1)}
              className={`flex items-center gap-1.5 hover:text-rose-500 transition-colors ${
                conversation.isLiked ? 'text-rose-500 font-semibold' : ''
              }`}
            >
              <Heart className={`w-4 h-4 ${conversation.isLiked ? 'fill-rose-500' : ''}`} />
              <span>{conversation.likes || 0}</span>
            </button>

            {user && (
              <button
                onClick={() => {
                  setActiveReplyId(isReplying ? null : conversation.id);
                  setReplyText('');
                }}
                className="flex items-center gap-1 hover:text-primary transition-colors"
              >
                <Reply className="w-3.5 h-3.5" />
                Reply
              </button>
            )}

            <button
              onClick={() => {
                setShowReplies(!showReplies);
                if (!showReplies) refetchReplies();
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 underline text-[11px]"
            >
              {showReplies ? 'Hide replies' : 'View replies'}
            </button>
          </div>

          {/* Inline reply box */}
          {isReplying && (
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Reply to @${conversation.senderName}...`}
                className="flex-1 text-xs p-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
              />
              <button
                onClick={() => {
                  if (replyText.trim()) {
                    onReply(replyText.trim());
                    setShowReplies(true);
                  }
                }}
                className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-green-600 transition"
              >
                Send
              </button>
            </div>
          )}

          {/* Threaded replies */}
          {showReplies && replies.length > 0 && (
            <div className="mt-4 pl-4 border-l-2 border-gray-100 dark:border-slate-700 space-y-3">
              {replies.map((rep: any) => (
                <div key={rep.id} className="text-xs">
                  <div className="flex items-center gap-1 mb-0.5">
                    <Link to={`/profile/${rep.senderName}`} className="font-semibold hover:underline text-gray-900 dark:text-gray-100">
                      @{rep.senderName}
                    </Link>
                    {rep.isSenderVerified && <VerifiedBadge size={11} />}
                    <span className="text-gray-400 text-[10px] ml-1">
                      {rep.timestamp ? new Date(Number(rep.timestamp)).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {formatMessage(rep.message)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthorWall;
