import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import http from '../api/http';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { useReadingTimer } from '../hooks/useReadingTimer';
import { useReadingProgress } from '../hooks/useReadingProgress';
import { ChapterSlider } from '../components/ChapterSlider';
import { ActionDialog } from '../components/feedback/ActionDialog';
import { TextAnnotationBar } from '../components/reader/TextAnnotationBar';
import { ChapterAnnotationsDrawer } from '../components/reader/ChapterAnnotationsDrawer';
import type { Chapter, ChapterSummary } from '../types/content';
import { formatChapterHtml } from '../utils/formatHtml';
import { ReadingCoinIndicator } from '../components/reader/ReadingCoinIndicator';

export default function ReaderPage() {
  const { storyId, partId } = useParams();
  const navigate = useNavigate();
  const [part, setPart] = useState<Chapter | null>(null);
  const [allParts, setAllParts] = useState<ChapterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissedResumePartId, setDismissedResumePartId] = useState<string | null>(null);
  const [isAnnotationsDrawerOpen, setIsAnnotationsDrawerOpen] = useState(false);
  
  const [isEndOfChapter, setIsEndOfChapter] = useState(false);

  // Reset isEndOfChapter when partId changes
  useEffect(() => {
    setIsEndOfChapter(false);
  }, [partId]);

  // Strict validation: stop when bottom of any chapter is reached
  useEffect(() => {
    if (isEndOfChapter) return;

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
  }, [partId, isEndOfChapter]);

  // Custom hooks for reading timer and progress
  const { pendingEarned, isPaused, progress, latestAward, error: earningsError } = useReadingTimer(
    storyId!,
    partId!,
    isEndOfChapter
  );
  const { savedPartId, savedScrollPosition, saveProgress, loaded: progressLoaded } = useReadingProgress(storyId!);

  const contentRef = useRef<HTMLDivElement>(null);

  const resumePartId = progressLoaded
    && savedPartId
    && savedPartId !== partId
    && savedPartId !== dismissedResumePartId
    ? savedPartId
    : null;

  // Handle restoring scroll position when part loads
  useEffect(() => {
    if (part && progressLoaded && savedPartId === partId && savedScrollPosition > 0) {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, scrollHeight * savedScrollPosition);
    }
  }, [part, progressLoaded, savedPartId, partId, savedScrollPosition]);

  // Periodic progress saving
  useEffect(() => {
    const saveInterval = setInterval(() => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPosition = scrollHeight > 0 ? window.scrollY / scrollHeight : 0;
      saveProgress(partId!, scrollPosition);
    }, 30000); // 30s
    return () => clearInterval(saveInterval);
  }, [partId, saveProgress]);

  // Save progress on unmount
  useEffect(() => {
    return () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPosition = scrollHeight > 0 ? window.scrollY / scrollHeight : 0;
      saveProgress(partId!, scrollPosition);
    };
  }, [partId, saveProgress]);

  // Load data
  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      try {
        setLoading(true);
        const [partRes, partsRes] = await Promise.all([
          http.get<Chapter>(`/parts/${partId}`, { signal: controller.signal }),
          http.get<ChapterSummary[]>(`/stories/${storyId}/parts?onlyPublished=true`, { signal: controller.signal })
        ]);
        if (partRes.data.storyId !== storyId) { setPart(null); return; }
        setPart(partRes.data);
        setAllParts(partsRes.data);
      } catch (err) {
        if (!controller.signal.aborted) { setPart(null); console.error("Failed to load reading data", err); }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    if (storyId && partId) void fetchData();
    return () => controller.abort();
  }, [storyId, partId]);

  const handleSelectPassage = (selectedText: string) => {
    setIsAnnotationsDrawerOpen(false);
    if (!contentRef.current) return;
    const elements = contentRef.current.querySelectorAll('p, h1, h2, h3, div');
    for (const el of elements) {
      if (el.textContent?.includes(selectedText)) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('bg-amber-100', 'transition-colors');
        setTimeout(() => el.classList.remove('bg-amber-100'), 2500);
        break;
      }
    }
  };

  if (loading) return <div className="text-center p-12">Loading...</div>;
  if (!part) return <div className="text-center p-12">Chapter not found</div>;

  const currentIndex = allParts.findIndex(p => p.id === partId);
  const prevPart = currentIndex > 0 ? allParts[currentIndex - 1] : null;
  const nextPart = currentIndex < allParts.length - 1 ? allParts[currentIndex + 1] : null;

  return (
    <div className="bg-[#FAF9F6] dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen pb-24 relative">
      {/* Floating Indicators Container */}
      <div className="fixed top-18 right-2 sm:top-24 sm:right-8 flex flex-col items-end gap-2 z-40">
        {/* Floating Circular Reading Coins Loading Indicator */}
        <ReadingCoinIndicator
          pendingEarned={pendingEarned}
          progress={progress}
          isPaused={isPaused}
          isEndOfChapter={isEndOfChapter}
          latestAward={latestAward}
        />

        {/* Floating Reactions Drawer Toggle Button */}
        <button
          onClick={() => setIsAnnotationsDrawerOpen(true)}
          className="bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-md sm:shadow-lg rounded-full px-3 py-1.5 flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 hover:text-primary dark:hover:text-primary transition-colors cursor-pointer border border-gray-200 dark:border-slate-800"
          title="View chapter reactions and comments"
        >
          <MessageSquare className="w-4 h-4 text-primary" />
          <span className="font-medium">Reactions</span>
        </button>
      </div>

      {earningsError && (
        <div className="fixed right-2 sm:right-8 top-28 sm:top-36 z-40 max-w-[calc(100vw-1rem)] sm:max-w-xs rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 px-3 py-2 text-xs text-red-700 dark:text-red-300 shadow">
          {earningsError}
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
        
        <div 
          ref={contentRef}
          className="prose dark:prose-invert prose-base sm:prose-lg max-w-none prose-p:leading-relaxed sm:prose-p:leading-loose text-gray-800 dark:text-gray-200 font-serif"
          dangerouslySetInnerHTML={{ __html: formatChapterHtml(part.content) }}
        />
        
        <div className="mt-12 sm:mt-16 flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-gray-200 dark:border-slate-800 pt-6 sm:pt-8 pb-16 text-sm sm:text-base">
          {prevPart ? (
            <Link to={`/story/${storyId}/read/${prevPart.id}`} className="text-primary hover:underline font-medium">
              &larr; Previous Chapter
            </Link>
          ) : <div className="hidden sm:block"></div>}
          
          {nextPart ? (
            <Link to={`/story/${storyId}/read/${nextPart.id}`} className="text-primary hover:underline font-medium">
              Next Chapter &rarr;
            </Link>
          ) : (
            <span className="text-gray-500 dark:text-gray-400 italic">End of story</span>
          )}
        </div>
      </div>

      <ChapterSlider 
        parts={allParts} 
        currentPartId={partId!} 
        onPartSelect={(newPartId) => navigate(`/story/${storyId}/read/${newPartId}`)} 
      />

      <ChapterAnnotationsDrawer
        partId={partId!}
        isOpen={isAnnotationsDrawerOpen}
        onClose={() => setIsAnnotationsDrawerOpen(false)}
        onSelectPassage={handleSelectPassage}
      />

      <ActionDialog
        open={Boolean(resumePartId)}
        title="Resume saved chapter?"
        description="You have saved progress in another chapter. You can resume there or continue reading this one."
        confirmLabel="Resume chapter"
        cancelLabel="Continue here"
        onCancel={() => {
          if (resumePartId) setDismissedResumePartId(resumePartId);
        }}
        onConfirm={() => {
          const destination = resumePartId;
          if (destination) setDismissedResumePartId(destination);
          if (destination) navigate(`/story/${storyId}/read/${destination}`);
        }}
      />
    </div>
  );
}
