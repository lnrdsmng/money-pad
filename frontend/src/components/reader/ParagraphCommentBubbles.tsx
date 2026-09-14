import { MessageSquare } from 'lucide-react';
import { useEffect, useState, type RefObject } from 'react';
import type { ParagraphAnchor, ParagraphCommentSummary } from '../../types/annotations';
import { formatCompactCount } from '../../utils/formatCompactCount';
import { getRenderedParagraphs } from '../../utils/paragraphAnchors';

interface PositionedBubble extends ParagraphAnchor {
  count: number;
  top: number;
}

interface ParagraphCommentBubblesProps {
  containerRef: RefObject<HTMLDivElement | null>;
  summaries: ParagraphCommentSummary[];
  onOpen: (paragraph: ParagraphAnchor) => void;
}

export function ParagraphCommentBubbles({
  containerRef,
  summaries,
  onOpen,
}: ParagraphCommentBubblesProps) {
  const [bubbles, setBubbles] = useState<PositionedBubble[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updatePositions = () => {
      const containerRect = container.getBoundingClientRect();
      const positioned = getRenderedParagraphs(container).flatMap((paragraph) => {
        const matching = summaries.filter((summary) => (
          Number(summary.startIndex) >= paragraph.startIndex
          && Number(summary.startIndex) < paragraph.endIndex
        ));
        const count = matching.reduce((total, summary) => total + Number(summary.commentCount), 0);
        if (count === 0) return [];

        const paragraphRect = paragraph.element.getBoundingClientRect();
        return [{
          ...paragraph,
          count,
          top: paragraphRect.top - containerRect.top + Math.min(24, paragraphRect.height / 2),
        }];
      });
      setBubbles(positioned);
    };

    updatePositions();
    const observer = new ResizeObserver(updatePositions);
    observer.observe(container);
    window.addEventListener('resize', updatePositions);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePositions);
    };
  }, [containerRef, summaries]);

  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-hidden={bubbles.length === 0}>
      {bubbles.map((bubble) => (
        <button
          key={`${bubble.startIndex}-${bubble.endIndex}`}
          type="button"
          onClick={() => onOpen(bubble)}
          className="pointer-events-auto absolute right-0 sm:-right-12 flex min-w-8 items-center justify-center gap-1 rounded-xl rounded-bl-sm border border-blue-200 bg-white px-2 py-1 text-[10px] font-bold text-blue-600 shadow-md transition hover:border-blue-400 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-blue-900 dark:bg-slate-800 dark:text-blue-300 dark:hover:bg-slate-700"
          style={{ top: bubble.top }}
          aria-label={`View ${bubble.count.toLocaleString()} comments on this paragraph`}
          title={`${bubble.count.toLocaleString()} comments`}
        >
          <MessageSquare className="h-3 w-3" />
          {formatCompactCount(bubble.count)}
        </button>
      ))}
    </div>
  );
}
