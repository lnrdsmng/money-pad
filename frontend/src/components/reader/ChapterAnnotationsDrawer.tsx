import { useQuery } from '@tanstack/react-query';
import { X, Heart, MessageSquare, Quote } from 'lucide-react';
import http from '../../api/http';
import { VerifiedBadge } from '../common/VerifiedBadge';

interface ChapterAnnotationsDrawerProps {
  partId: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectPassage?: (selectedText: string) => void;
}

export const ChapterAnnotationsDrawer = ({
  partId,
  isOpen,
  onClose,
  onSelectPassage,
}: ChapterAnnotationsDrawerProps) => {
  const { data: annotations = [], isLoading } = useQuery({
    queryKey: ['annotations', partId],
    queryFn: async () => {
      const res = await http.get(`/parts/${partId}/annotations`);
      return res.data;
    },
    enabled: isOpen && !!partId,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-base sm:text-lg text-gray-900 dark:text-gray-100">
              Passage Reactions ({annotations.length})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="text-center py-10 text-sm text-gray-500">Loading annotations...</div>
          ) : annotations.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-500">
              <Quote className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>No passage reactions yet.</p>
              <p className="text-xs text-gray-400 mt-1">Highlight any text in the chapter to like it or leave a comment!</p>
            </div>
          ) : (
            annotations.map((ann: any) => (
              <div
                key={ann.id}
                onClick={() => {
                  if (onSelectPassage) onSelectPassage(ann.selectedText);
                }}
                className="bg-gray-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-gray-100 dark:border-slate-800 text-xs hover:border-primary/40 transition-colors cursor-pointer"
              >
                {/* Quote Box */}
                <div className="border-l-3 border-amber-400 pl-2.5 py-0.5 text-gray-600 dark:text-gray-300 italic mb-2.5 line-clamp-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-r">
                  "{ann.selectedText}"
                </div>

                {/* Reaction / Comment info */}
                <div className="flex justify-between items-center text-[11px] text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                      @{ann.username}
                    </span>
                    {ann.isUserVerified && <VerifiedBadge size={12} />}
                    {ann.type === 'LIKE' ? (
                      <span className="inline-flex items-center gap-0.5 text-rose-500 font-medium">
                        <Heart className="w-3 h-3 fill-rose-500" /> liked this
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-blue-500 font-medium">
                        <MessageSquare className="w-3 h-3" /> commented
                      </span>
                    )}
                  </div>
                  <span className="text-gray-400 text-[10px]">
                    {ann.timestamp ? new Date(Number(ann.timestamp)).toLocaleDateString() : ''}
                  </span>
                </div>

                {ann.content && (
                  <p className="mt-2 text-gray-800 dark:text-gray-100 text-xs pl-2 bg-white dark:bg-slate-800 p-2 rounded-lg border border-gray-100 dark:border-slate-700">
                    {ann.content}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ChapterAnnotationsDrawer;
