import { MessageSquare, Sparkles } from 'lucide-react';
import { GroupChat } from '../components/GroupChat';

export default function CommunityPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <MessageSquare className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
              Community Lounge
            </h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#F5E9DA] text-stone-800 dark:bg-amber-950/40 dark:text-amber-200 border border-amber-200 dark:border-amber-900/40 px-2.5 py-0.5 rounded-full">
              <Sparkles className="w-3 h-3 text-accent" />
              Live Chat
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Connect with fellow readers and authors, discuss your favorite stories, and share writing tips.
          </p>
        </div>
      </div>

      <div className="w-full">
        <GroupChat />
      </div>
    </div>
  );
}
