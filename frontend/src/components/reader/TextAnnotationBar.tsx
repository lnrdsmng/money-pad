import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Heart, MessageSquare, X, Send } from 'lucide-react';
import http from '../../api/http';
import { useAuth } from '../../auth/AuthProvider';
import { useFeedback } from '../feedback/feedback';

interface TextAnnotationBarProps {
  partId: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onAnnotationCreated?: () => void;
}

export const TextAnnotationBar = ({
  partId,
  containerRef,
  onAnnotationCreated,
}: TextAnnotationBarProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const feedback = useFeedback();

  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(0);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleSelectionChange = () => {
      if (showCommentInput) return; // Don't hide if currently typing comment

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !containerRef.current) {
        setPosition(null);
        return;
      }

      const text = selection.toString().trim();
      if (text.length < 3) {
        setPosition(null);
        return;
      }

      // Ensure selection is inside container
      const range = selection.getRangeAt(0);
      if (!containerRef.current.contains(range.commonAncestorContainer)) {
        setPosition(null);
        return;
      }

      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();

      const top = rect.top - 50 + window.scrollY;
      const left = Math.max(10, rect.left + rect.width / 2 - 80);

      setSelectedText(text);
      setStartIndex(Math.max(0, Math.floor(rect.top - containerRect.top)));
      setEndIndex(Math.max(0, Math.floor(rect.bottom - containerRect.top)));
      setPosition({ top, left });
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [containerRef, showCommentInput]);

  const submitAnnotation = async (type: 'LIKE' | 'COMMENT', noteContent?: string) => {
    if (!user) {
      feedback.info('Please log in to react or comment on passages.');
      return;
    }
    if (!selectedText) return;

    setIsSubmitting(true);
    try {
      await http.post(`/parts/${partId}/annotations`, {
        userId: user.id,
        selectedText,
        startIndex,
        endIndex,
        type,
        content: noteContent || null,
      });

      feedback.success(type === 'LIKE' ? 'Passage liked!' : 'Annotation comment posted!');
      setPosition(null);
      setShowCommentInput(false);
      setComment('');
      window.getSelection()?.removeAllRanges();
      queryClient.invalidateQueries({ queryKey: ['annotations', partId] });
      onAnnotationCreated?.();
    } catch {
      feedback.error('Could not save annotation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!position) return null;

  return (
    <div
      className="absolute z-50 animate-in fade-in zoom-in duration-150"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
    >
      <div className="bg-gray-900 text-white rounded-full shadow-2xl px-3 py-1.5 flex items-center gap-2 text-xs border border-gray-700">
        {!showCommentInput ? (
          <>
            <button
              onClick={() => submitAnnotation('LIKE')}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 hover:text-rose-400 transition-colors px-2 py-1 rounded-full hover:bg-gray-800 cursor-pointer"
              title="Like this passage"
            >
              <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
              <span>Like</span>
            </button>

            <span className="text-gray-600">|</span>

            <button
              onClick={() => setShowCommentInput(true)}
              className="flex items-center gap-1.5 hover:text-primary transition-colors px-2 py-1 rounded-full hover:bg-gray-800 cursor-pointer"
              title="Add inline comment"
            >
              <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
              <span>Comment</span>
            </button>

            <button
              onClick={() => setPosition(null)}
              className="text-gray-500 hover:text-gray-300 p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2 p-1">
            <input
              type="text"
              autoFocus
              placeholder="Your thought on this passage..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && comment.trim()) {
                  submitAnnotation('COMMENT', comment.trim());
                }
              }}
              className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1 text-white focus:outline-none focus:border-primary w-48"
            />
            <button
              onClick={() => submitAnnotation('COMMENT', comment.trim())}
              disabled={!comment.trim() || isSubmitting}
              className="p-1 bg-primary rounded-md text-white hover:bg-green-600 transition disabled:opacity-50"
            >
              <Send className="w-3 h-3" />
            </button>
            <button
              onClick={() => {
                setShowCommentInput(false);
                setPosition(null);
              }}
              className="text-gray-400 hover:text-gray-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TextAnnotationBar;
