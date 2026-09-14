import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MessageSquare, X, Send } from 'lucide-react';
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
  const selectedParagraphRef = useRef<HTMLParagraphElement | null>(null);
  const isCommenting = useRef(false);

  const clearParagraphHighlight = () => {
    selectedParagraphRef.current?.classList.remove(
      'bg-amber-100',
      'dark:bg-amber-950/40',
      'transition-colors',
    );
    selectedParagraphRef.current = null;
  };

  useEffect(() => {
    const handleSelectionChange = () => {
      if (isCommenting.current) return;

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !containerRef.current) {
        setPosition(null);
        clearParagraphHighlight();
        return;
      }

      const range = selection.getRangeAt(0);
      const selectedNode = range.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.parentElement
        : range.startContainer as Element;
      const paragraph = selectedNode?.closest('p');
      const endNode = range.endContainer.nodeType === Node.TEXT_NODE
        ? range.endContainer.parentElement
        : range.endContainer as Element;
      if (!paragraph || endNode?.closest('p') !== paragraph || !containerRef.current.contains(paragraph)) {
        setPosition(null);
        clearParagraphHighlight();
        return;
      }

      const rawParagraphText = paragraph.textContent || '';
      const text = rawParagraphText.trim();
      if (!text) {
        setPosition(null);
        clearParagraphHighlight();
        return;
      }

      const selectedTextRect = range.getBoundingClientRect();
      if (selection.toString().trim() !== text) {
        const paragraphRange = document.createRange();
        paragraphRange.selectNodeContents(paragraph);
        selection.removeAllRanges();
        selection.addRange(paragraphRange);
      }

      clearParagraphHighlight();
      paragraph.classList.add('bg-amber-100', 'dark:bg-amber-950/40', 'transition-colors');
      selectedParagraphRef.current = paragraph;

      const precedingContent = document.createRange();
      precedingContent.selectNodeContents(containerRef.current);
      precedingContent.setEndBefore(paragraph);
      const leadingWhitespace = rawParagraphText.indexOf(text);
      const paragraphStart = precedingContent.toString().length + Math.max(0, leadingWhitespace);

      const anchorRect = selectedTextRect.width > 0 ? selectedTextRect : paragraph.getBoundingClientRect();
      const top = anchorRect.top - 50 + window.scrollY;
      const idealLeft = anchorRect.left + anchorRect.width / 2 - 80;
      const left = Math.max(10, Math.min(window.innerWidth - 170, idealLeft));

      setSelectedText(text);
      setStartIndex(paragraphStart);
      setEndIndex(paragraphStart + text.length);
      setPosition({ top, left });
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [containerRef]);

  useEffect(() => () => clearParagraphHighlight(), [partId]);

  const submitAnnotation = async (noteContent: string) => {
    if (!user) {
      feedback.info('Please log in to comment on passages.');
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
        type: 'COMMENT',
        content: noteContent,
      });

      feedback.success('Annotation comment posted!');
      setPosition(null);
      setShowCommentInput(false);
      isCommenting.current = false;
      setComment('');
      clearParagraphHighlight();
      window.getSelection()?.removeAllRanges();
      queryClient.invalidateQueries({ queryKey: ['annotations', partId] });
      queryClient.invalidateQueries({ queryKey: ['annotationSummaries', partId] });
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
      onPointerDown={() => { isCommenting.current = true; }}
    >
      <div className="bg-gray-900 text-white rounded-full shadow-2xl px-3 py-1.5 flex items-center gap-2 text-xs border border-gray-700">
        {!showCommentInput ? (
          <>
            <button
              onPointerDown={(event) => {
                event.preventDefault();
                isCommenting.current = true;
              }}
              onClick={() => setShowCommentInput(true)}
              className="flex items-center gap-1.5 hover:text-primary transition-colors px-2 py-1 rounded-full hover:bg-gray-800 cursor-pointer"
              title="Add inline comment"
            >
              <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
              <span>Comment</span>
            </button>

            <button
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setPosition(null);
                isCommenting.current = false;
                clearParagraphHighlight();
                window.getSelection()?.removeAllRanges();
              }}
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
                  submitAnnotation(comment.trim());
                }
              }}
              className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1 text-white focus:outline-none focus:border-primary w-48"
            />
            <button
              onClick={() => submitAnnotation(comment.trim())}
              disabled={!comment.trim() || isSubmitting}
              className="p-1 bg-primary rounded-md text-white hover:bg-green-600 transition disabled:opacity-50"
            >
              <Send className="w-3 h-3" />
            </button>
            <button
              onClick={() => {
                setShowCommentInput(false);
                isCommenting.current = false;
                setPosition(null);
                clearParagraphHighlight();
                window.getSelection()?.removeAllRanges();
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
