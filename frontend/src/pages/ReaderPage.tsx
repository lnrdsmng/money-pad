import { useCallback, useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import http from '../api/http';
import { ArrowLeft } from 'lucide-react';
import { useReadingTimer } from '../hooks/useReadingTimer';
import { useReadingProgress } from '../hooks/useReadingProgress';
import { ChapterSlider } from '../components/ChapterSlider';
import { ActionDialog } from '../components/feedback/ActionDialog';
import { TextAnnotationBar } from '../components/reader/TextAnnotationBar';
import { ChapterAnnotationsDrawer } from '../components/reader/ChapterAnnotationsDrawer';
import { ParagraphCommentBubbles } from '../components/reader/ParagraphCommentBubbles';
import type { ParagraphAnchor, ParagraphCommentSummary } from '../types/annotations';
import type { Chapter, ChapterSummary } from '../types/content';
import { formatChapterHtml } from '../utils/formatHtml';
import { ReadingCoinIndicator } from '../components/reader/ReadingCoinIndicator';

export default function ReaderPage() {
  const { storyId, partId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [part, setPart] = useState<Chapter | null>(null);
  const [allParts, setAllParts] = useState<ChapterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEndOfChapter, setIsEndOfChapter] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [openParagraph, setOpenParagraph] = useState<(ParagraphAnchor & { partId: string }) | null>(null);

  // Strict validation: stop when bottom of any chapter is reached
  useEffect(() => {
    if (loading || part === null || part.id !== partId || isEndOfChapter) return;

    const checkScrollBottom = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return;
      const scrollPosition = window.scrollY / scrollHeight;
      if (scrollPosition >= 0.96 || window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 70) {
        setIsEndOfChapter(true);
      }
    };

    window.addEventListener('scroll', checkScrollBottom, { passive: true });
    checkScrollBottom();
    return () => window.removeEventListener('scroll', checkScrollBottom);
  }, [partId, part, loading, isEndOfChapter]);

  // Custom hooks for reading timer and progress
  const { pendingEarned, isPaused, isConfirming, progress, latestAward, error: earningsError } = useReadingTimer(
    storyId!,
    partId!,
    isEndOfChapter,
    !isEndOfChapter && !loading && part !== null && part.id === partId && part.storyId === storyId,
  );
  const { savedPartId, savedScrollPosition, saveProgress, loaded: progressLoaded } = useReadingProgress(storyId!);

  const contentRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<HTMLDivElement>(null);
  const completedPartRequests = useRef(new Set<string>());
  const pendingNavigationPartId = useRef<string | null>(null);
  const restoredPartId = useRef<string | null>(null);
  const latestScrollPosition = useRef(0);
  const guardedPartId = useRef<string | null>(null);

  const { data: annotationSummaries = [] } = useQuery<ParagraphCommentSummary[]>({
    queryKey: ['annotationSummaries', partId],
    queryFn: async () => {
      const response = await http.get(`/parts/${partId}/annotation-summaries`);
      return response.data;
    },
    enabled: Boolean(partId),
  });

  const getScrollPosition = useCallback(() => {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    return scrollHeight > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollHeight)) : 0;
  }, []);

  const updateScrollPosition = useCallback(() => {
    const position = getScrollPosition();
    latestScrollPosition.current = position;
    setScrollProgress(position);
    return position;
  }, [getScrollPosition]);

  const resumePartId = progressLoaded
    && savedPartId
    && savedPartId !== partId
    ? savedPartId
    : null;

  // Persist completion once the reader reaches the bottom. The endpoint is idempotent,
  // and retries cover brief connection interruptions without restarting the timer.
  useEffect(() => {
    if (!isEndOfChapter || !partId || part?.id !== partId || part.isCompletedByCurrentUser) return;
    if (completedPartRequests.current.has(partId)) return;

    completedPartRequests.current.add(partId);
    if (pendingNavigationPartId.current === null) {
      void saveProgress(partId, 1);
    }

    let disposed = false;
    const persistCompletion = async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await http.post(`/parts/${partId}/read`);
          if (!disposed) {
            setPart(current => current?.id === partId
              ? { ...current, isCompletedByCurrentUser: true }
              : current);
            setCompletionError(null);
            void queryClient.invalidateQueries({ queryKey: ['story', storyId] });
            void queryClient.invalidateQueries({ queryKey: ['parts', storyId] });
            void queryClient.invalidateQueries({ queryKey: ['referralMilestones'] });
          }
          return;
        } catch {
          if (attempt < 2) {
            await new Promise(resolve => window.setTimeout(resolve, 1000 * (attempt + 1)));
          }
        }
      }

      if (!disposed) {
        completedPartRequests.current.delete(partId);
        setCompletionError('Chapter completion could not be saved. Check your connection before leaving.');
      }
    };

    void persistCompletion();
    return () => { disposed = true; };
  }, [isEndOfChapter, part, partId, queryClient, saveProgress, storyId]);

  useEffect(() => {
    restoredPartId.current = null;
    latestScrollPosition.current = 0;
  }, [partId]);

  // Handle restoring scroll position when part loads
  useEffect(() => {
    if (!part || !progressLoaded || savedPartId !== partId) return;
    if (restoredPartId.current === partId) return;

    restoredPartId.current = partId!;
    let disposed = false;
    const waitForLayout = async () => {
      const images = Array.from(readerRef.current?.querySelectorAll('img') || []);
      const imageLoads = images.map(image => image.complete
        ? Promise.resolve()
        : new Promise<void>(resolve => {
          image.addEventListener('load', () => resolve(), { once: true });
          image.addEventListener('error', () => resolve(), { once: true });
        }));
      const timeout = new Promise<void>(resolve => window.setTimeout(resolve, 1000));
      await Promise.race([Promise.all(imageLoads).then(() => undefined), timeout]);
      await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()));
      if (disposed) return;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, scrollHeight * savedScrollPosition);
      latestScrollPosition.current = savedScrollPosition;
      setScrollProgress(savedScrollPosition);
    };
    void waitForLayout();
    return () => { disposed = true; };
  }, [part, progressLoaded, savedPartId, partId, savedScrollPosition]);

  // Keep the reading-position slider synchronized with ordinary page scrolling.
  useEffect(() => {
    let frame: number | null = null;
    const handleScroll = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        updateScrollPosition();
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [updateScrollPosition]);

  // Periodic progress saving
  useEffect(() => {
    const saveInterval = setInterval(() => {
      if (!partId || loading || part?.id !== partId) return;
      void saveProgress(partId, latestScrollPosition.current);
    }, 30000); // 30s
    return () => clearInterval(saveInterval);
  }, [partId, part, loading, saveProgress]);

  // Save when leaving the reader, but do not let the previous chapter overwrite
  // progress during deliberate in-reader navigation.
  useEffect(() => {
    const currentPartId = partId;
    const loadedPartId = part?.id;
    return () => {
      if (!currentPartId) return;
      if (loadedPartId !== currentPartId) return;
      if (pendingNavigationPartId.current !== null) return;
      void saveProgress(currentPartId, latestScrollPosition.current);
    };
  }, [partId, part?.id, saveProgress]);

  // Add a same-URL history entry so browser Back is handled before the reader route unmounts.
  useEffect(() => {
    if (!partId) return;
    const guardKey = `${storyId}:${partId}`;
    if (guardedPartId.current !== guardKey) {
      const historyState = typeof window.history.state === 'object' && window.history.state !== null
        ? window.history.state
        : {};
      window.history.pushState({ ...historyState, moneyPadReaderGuard: guardKey }, '', window.location.href);
      guardedPartId.current = guardKey;
    }

    const handleBrowserBack = () => {
      if (partId && part?.id === partId) {
        const position = getScrollPosition();
        latestScrollPosition.current = position;
        void saveProgress(partId, position);
      }
      navigate('/explore', { replace: true });
    };
    window.addEventListener('popstate', handleBrowserBack);
    return () => window.removeEventListener('popstate', handleBrowserBack);
  }, [getScrollPosition, navigate, part, partId, saveProgress, storyId]);

  // Load data
  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      try {
        setLoading(true);
        setCompletionError(null);
        const [partRes, partsRes] = await Promise.all([
          http.get<Chapter>(`/parts/${partId}`, { signal: controller.signal }),
          http.get<ChapterSummary[]>(`/stories/${storyId}/parts?onlyPublished=true`, { signal: controller.signal })
        ]);
        if (partRes.data.storyId !== storyId) { setPart(null); return; }
        setIsEndOfChapter(Boolean(partRes.data.isCompletedByCurrentUser));
        setPart(partRes.data);
        setAllParts(partsRes.data);
        if (pendingNavigationPartId.current === partRes.data.id) {
          pendingNavigationPartId.current = null;
        }
      } catch (err) {
        if (!controller.signal.aborted) { setPart(null); console.error("Failed to load reading data", err); }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    if (storyId && partId) void fetchData();
    return () => controller.abort();
  }, [storyId, partId]);

  const navigateToPart = (destinationPartId: string) => {
    if (!destinationPartId || destinationPartId === partId) return;
    pendingNavigationPartId.current = destinationPartId;
    void saveProgress(destinationPartId, 0);
    navigate(`/story/${storyId}/read/${destinationPartId}`);
  };

  const handleSliderChange = (position: number) => {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: scrollHeight * position, behavior: 'auto' });
    latestScrollPosition.current = position;
    setScrollProgress(position);
  };

  if (loading) return <div className="text-center p-12">Loading...</div>;
  if (!part) return <div className="text-center p-12">Chapter not found</div>;

  const currentIndex = allParts.findIndex(p => p.id === partId);
  const prevPart = currentIndex > 0 ? allParts[currentIndex - 1] : null;
  const nextPart = currentIndex < allParts.length - 1 ? allParts[currentIndex + 1] : null;

  return (
    <div ref={readerRef} className="bg-[#FAF9F6] dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen pb-24 relative">
      {/* Floating Indicators Container */}
      <div className="fixed top-18 right-2 sm:top-24 sm:right-8 flex flex-col items-end gap-2 z-40">
        {/* Floating Circular Reading Coins Loading Indicator */}
        <ReadingCoinIndicator
          pendingEarned={pendingEarned}
          progress={progress}
          isPaused={isPaused}
          isConfirming={isConfirming}
          isEndOfChapter={isEndOfChapter}
          latestAward={latestAward}
        />
      </div>

      {(earningsError || completionError) && (
        <div className="fixed right-2 sm:right-8 top-28 sm:top-36 z-40 max-w-[calc(100vw-1rem)] sm:max-w-xs rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 px-3 py-2 text-xs text-red-700 dark:text-red-300 shadow">
          {completionError || earningsError}
        </div>
      )}

      {/* Floating Selection Tool for Annotations */}
      <TextAnnotationBar
        partId={partId!}
        containerRef={contentRef}
      />

      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 sm:py-8 relative">
        <Link to={`/story/${storyId}`} className="inline-flex items-center text-xs sm:text-sm text-gray-500 dark:text-gray-400 hover:text-primary mb-6 sm:mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" />
          Back to Story
        </Link>

        {/* Chapter Header Image if present */}
        {part.headerImageUrl && (
          <div className="w-full h-48 sm:h-64 rounded-xl overflow-hidden mb-6 sm:mb-8 shadow-sm">
            <img src={part.headerImageUrl} alt={part.title} className="w-full h-full object-cover" />
          </div>
        )}
        
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4 font-serif break-words">{part.title}</h1>
        </div>
        
        <div className="relative">
          <div
            ref={contentRef}
            className="prose dark:prose-invert prose-base sm:prose-lg max-w-none pr-10 sm:pr-0 prose-p:leading-relaxed sm:prose-p:leading-loose text-gray-800 dark:text-gray-200 font-serif"
            dangerouslySetInnerHTML={{ __html: formatChapterHtml(part.content) }}
          />
          <ParagraphCommentBubbles
            containerRef={contentRef}
            summaries={annotationSummaries}
            onOpen={(paragraph) => setOpenParagraph({ ...paragraph, partId: partId! })}
          />
        </div>
        
        <div className="mt-12 sm:mt-16 flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-gray-200 dark:border-slate-800 pt-6 sm:pt-8 pb-16 text-sm sm:text-base">
          {prevPart ? (
            <Link
              to={`/story/${storyId}/read/${prevPart.id}`}
              onClick={(event) => { event.preventDefault(); navigateToPart(prevPart.id); }}
              className="text-primary hover:underline font-medium"
            >
              &larr; Previous Chapter
            </Link>
          ) : <div className="hidden sm:block"></div>}
          
          {nextPart ? (
            <Link
              to={`/story/${storyId}/read/${nextPart.id}`}
              onClick={(event) => { event.preventDefault(); navigateToPart(nextPart.id); }}
              className="text-primary hover:underline font-medium"
            >
              Next Chapter &rarr;
            </Link>
          ) : (
            <span className="text-gray-500 dark:text-gray-400 italic">End of story</span>
          )}
        </div>
      </div>

      <ChapterSlider 
        progress={scrollProgress}
        onProgressChange={handleSliderChange}
      />

      <ChapterAnnotationsDrawer
        key={openParagraph ? `${openParagraph.partId}-${openParagraph.startIndex}` : 'closed'}
        partId={partId!}
        paragraph={openParagraph?.partId === partId ? openParagraph : null}
        onClose={() => setOpenParagraph(null)}
      />

      <ActionDialog
        open={Boolean(resumePartId)}
        title="Resume saved chapter?"
        description="You have saved progress in another chapter. You can resume there or continue reading this one."
        confirmLabel="Resume chapter"
        cancelLabel="Continue here"
        onCancel={() => {
          if (!partId) return;
          void saveProgress(partId, latestScrollPosition.current);
        }}
        onConfirm={() => {
          const destination = resumePartId;
          if (destination) {
            pendingNavigationPartId.current = destination;
            navigate(`/story/${storyId}/read/${destination}`);
          }
        }}
      />
    </div>
  );
}
