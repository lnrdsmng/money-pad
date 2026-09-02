import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import http from '../api/http';
import { ArrowLeft, Coins } from 'lucide-react';
import { useReadingTimer } from '../hooks/useReadingTimer';
import { useReadingProgress } from '../hooks/useReadingProgress';
import { ChapterSlider } from '../components/ChapterSlider';
import { ActionDialog } from '../components/feedback/ActionDialog';

export default function ReaderPage() {
  const { storyId, partId } = useParams();
  const navigate = useNavigate();
  const [part, setPart] = useState<any>(null);
  const [allParts, setAllParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissedResumePartId, setDismissedResumePartId] = useState<string | null>(null);
  
  // Custom hooks for new features
  const { pendingEarned, isPaused, error: earningsError } = useReadingTimer(storyId!, partId!);
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
    const fetchData = async () => {
      try {
        setLoading(true);
        const [partRes, partsRes] = await Promise.all([
          http.get(`/parts/${partId}`),
          http.get(`/stories/${storyId}/parts`)
        ]);
        setPart(partRes.data);
        setAllParts(partsRes.data);
      } catch (err) {
        console.error("Failed to load reading data", err);
      } finally {
        setLoading(false);
      }
    };
    if (storyId && partId) fetchData();
  }, [storyId, partId]);

  if (loading) return <div className="text-center p-12">Loading...</div>;
  if (!part) return <div className="text-center p-12">Chapter not found</div>;

  const currentIndex = allParts.findIndex(p => p.id === partId);
  const prevPart = currentIndex > 0 ? allParts[currentIndex - 1] : null;
  const nextPart = currentIndex < allParts.length - 1 ? allParts[currentIndex + 1] : null;

  return (
    <div className="bg-[#FAF9F6] min-h-screen pb-24">
      {/* Floating Coins Indicator */}
      <div className={`fixed top-24 right-8 bg-white shadow-lg rounded-full px-4 py-2 flex items-center space-x-2 z-40 transition-opacity ${isPaused ? 'opacity-50' : 'opacity-100'}`}>
        <Coins className="text-yellow-500 w-5 h-5" />
        <span className="font-bold text-gray-800">Pending ₱{pendingEarned.toFixed(3)}</span>
        {isPaused && <span className="text-xs text-red-500 ml-2">(Paused)</span>}
      </div>

      {earningsError && (
        <div className="fixed right-8 top-36 z-40 max-w-xs rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 shadow">
          {earningsError}
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-8 relative">
        <Link to={`/story/${storyId}`} className="inline-flex items-center text-gray-500 hover:text-primary mb-8 transition-colors">
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Story
        </Link>
        
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4 font-serif">{part.title}</h1>
        </div>
        
        <div 
          ref={contentRef}
          className="prose prose-lg max-w-none prose-p:leading-loose text-gray-800 font-serif"
          dangerouslySetInnerHTML={{ __html: part.content }}
        />
        
        <div className="mt-16 flex justify-between items-center border-t border-gray-200 pt-8 pb-16">
          {prevPart ? (
            <Link to={`/story/${storyId}/read/${prevPart.id}`} className="text-primary hover:underline font-medium">
              &larr; Previous Chapter
            </Link>
          ) : <div></div>}
          
          {nextPart ? (
            <Link to={`/story/${storyId}/read/${nextPart.id}`} className="text-primary hover:underline font-medium">
              Next Chapter &rarr;
            </Link>
          ) : (
            <span className="text-gray-500 italic">End of story</span>
          )}
        </div>
      </div>

      <ChapterSlider 
        parts={allParts} 
        currentPartId={partId!} 
        onPartSelect={(newPartId) => navigate(`/story/${storyId}/read/${newPartId}`)} 
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
