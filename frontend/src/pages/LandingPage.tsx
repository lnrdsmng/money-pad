import { Link } from 'react-router-dom';
import { BookOpen, DollarSign, MessageSquare, Sparkles } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center py-12 sm:py-20 px-3 sm:px-4 text-center max-w-5xl mx-auto">
      <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-[#F5E9DA] text-stone-800 dark:bg-amber-950/40 dark:text-amber-200 border border-amber-200/80 dark:border-amber-900/50 mb-6">
        <Sparkles className="w-3.5 h-3.5 text-accent" />
        Read, Write & Earn
      </span>

      <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-4 sm:mb-6 leading-tight">
        Welcome to MoneyPad
      </h1>

      <p className="mt-2 max-w-2xl text-base sm:text-lg text-gray-600 dark:text-gray-300 mx-auto mb-8 sm:mb-10 leading-relaxed">
        The simplest way to discover captivating web novels, publish your chapters, and monetize your stories with automated payouts.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto max-w-xs sm:max-w-none justify-center mb-16">
        <Link
          to="/register"
          className="w-full sm:w-auto bg-accent hover:bg-accent-hover active:scale-98 text-white font-bold px-8 py-3.5 rounded-xl shadow-xs transition text-base sm:text-lg text-center cursor-pointer"
        >
          Get Started Free
        </Link>
        <Link
          to="/login"
          className="w-full sm:w-auto bg-white hover:bg-gray-50 text-gray-900 font-semibold px-8 py-3.5 rounded-xl border border-gray-300 dark:border-slate-700 shadow-xs transition text-base sm:text-lg dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800 text-center cursor-pointer"
        >
          Login
        </Link>
      </div>

      {/* 3 Value Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs">
          <div className="p-3 bg-primary/10 text-primary rounded-xl w-fit mb-4">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 mb-1">Reader Rewards</h3>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            Earn real Reader Coins every minute you spend reading published chapters, redeemable directly to GCash or Maya.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs">
          <div className="p-3 bg-[#F5E9DA] dark:bg-amber-950/40 text-stone-800 dark:text-amber-200 rounded-xl w-fit mb-4">
            <DollarSign className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 mb-1">Author Royalties</h3>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            Publish your works, gain verified status, and earn author royalties on every 100 chapter views.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs">
          <div className="p-3 bg-primary/10 text-primary rounded-xl w-fit mb-4">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 mb-1">Lively Community</h3>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            Connect in real time with fellow storytellers, react to passages, and discuss plot twists in our community hub.
          </p>
        </div>
      </div>
    </div>
  );
}
