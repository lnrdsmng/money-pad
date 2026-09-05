import { Link } from 'react-router-dom';
import {
  Sparkles,
  BookOpen,
  DollarSign,
  MessageSquare,
  ArrowRight,
  Heart,
  Star,
  PenTool,
  CheckCircle2,
  Coins,
  LogIn,
  Users,
  UserPlus,
  Pencil,
  Wallet,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center py-6 sm:py-12 px-3 sm:px-6 max-w-6xl mx-auto space-y-16 sm:space-y-24">
      {/* Hero Section */}
      <section className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center pt-4 sm:pt-8">
        {/* Left Column: Headlines & CTAs */}
        <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left">
          {/* Cute pill banner */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold bg-[#F5E9DA] text-stone-800 dark:bg-amber-950/40 dark:text-amber-200 border-2 border-amber-300/80 dark:border-amber-900/50 shadow-xs mb-6 animate-wiggle">
            <Sparkles className="w-4 h-4 text-accent fill-accent" />
            <span>Meet your coziest story haven</span>
          </div>

          {/* Catchy Main Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-gray-900 dark:text-white leading-[1.15] mb-4 sm:mb-6">
            Where Stories Meet{' '}
            <span className="relative inline-block text-primary">
              Real Rewards!
              <svg
                className="absolute -bottom-2 left-0 w-full h-3 text-[#F5E9DA] dark:text-amber-900/60 -z-10"
                viewBox="0 0 200 12"
                fill="currentColor"
                preserveAspectRatio="none"
              >
                <path d="M0,8 Q50,0 100,8 T200,8" stroke="currentColor" strokeWidth="6" fill="none" strokeLinecap="round" />
              </svg>
            </span>
          </h1>

          {/* Subtitle */}
          <p className="max-w-xl text-base sm:text-lg text-gray-600 dark:text-gray-300 mb-8 sm:mb-10 leading-relaxed">
            Welcome to <strong className="text-primary font-bold">MoneyPad</strong>! Scribble heartwarming tales, discover pocket-sized web novels, and earn Reader Coins and Author Royalties with every chapter.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto justify-center lg:justify-start mb-8">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover active:scale-95 text-white font-black px-8 py-4 rounded-full shadow-lg shadow-primary/25 transition-all text-base sm:text-lg text-center cursor-pointer group"
            >
              <span>Start Writing Free</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 bg-[#F5E9DA] hover:bg-[#eedfcb] active:scale-95 text-stone-800 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 font-bold px-7 py-4 rounded-full border-2 border-amber-200/80 dark:border-slate-700 shadow-sm transition-all text-base sm:text-lg text-center cursor-pointer"
            >
              <LogIn className="w-5 h-5 text-stone-700 dark:text-stone-300" />
              <span>Hop In (Login)</span>
            </Link>
          </div>

          {/* Mini social proof trust badges */}
          <div className="flex items-center gap-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center text-amber-400">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              Trusted by 1,000+ enthusiastic story lovers!
            </span>
          </div>
        </div>

        {/* Right Column: Mascot with Floating Kawaii Badges */}
        <div className="lg:col-span-5 flex justify-center items-center relative py-6">
          {/* Soft background aura */}
          <div className="absolute w-72 h-72 sm:w-88 sm:h-88 bg-[#F5E9DA] dark:bg-emerald-950/20 rounded-full blur-3xl -z-10" />

          <div className="relative group">
            {/* Mascot Character Image */}
            <div className="animate-float relative z-10">
              <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-3xl sm:rounded-4xl shadow-xl shadow-stone-200/60 dark:shadow-none border-4 border-[#F5E9DA] dark:border-slate-800 max-w-[280px] sm:max-w-[340px] mx-auto">
                <img
                  src="/images/mascot.jpg"
                  alt="MoneyPad cute notepad mascot holding a pen"
                  className="w-full h-auto rounded-2xl sm:rounded-3xl object-cover select-none pointer-events-none"
                  width={340}
                  height={340}
                />
              </div>
            </div>

            {/* Mascot Speech Bubble */}
            <div className="absolute -top-4 -right-2 sm:-right-6 z-20 bg-white dark:bg-slate-800 border-2 border-primary text-gray-800 dark:text-gray-100 px-3.5 py-2 rounded-2xl rounded-bl-xs shadow-md text-xs sm:text-sm font-extrabold flex items-center gap-1.5 animate-bounce">
              <span>Ready to write?</span>
              <Pencil className="w-3.5 h-3.5 text-primary" />
            </div>

            {/* Floating Tag 1: Coins */}
            <div className="absolute -bottom-3 -left-3 sm:-left-6 z-20 bg-[#FAF9F6] dark:bg-slate-800 border-2 border-amber-300 dark:border-amber-800 text-stone-800 dark:text-amber-200 px-3 py-1.5 rounded-full shadow-md text-xs font-bold flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>Coins every minute!</span>
            </div>

            {/* Floating Tag 2: Heart & Community */}
            <div className="hidden sm:flex absolute top-1/2 -left-8 z-20 bg-white dark:bg-slate-800 border-2 border-accent/40 text-stone-800 dark:text-stone-200 px-3 py-1.5 rounded-full shadow-md text-xs font-bold items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-accent fill-accent" />
              <span>100% Cozy</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Cute Value Cards Section */}
      <section className="w-full">
        <div className="text-center mb-10 sm:mb-14">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary mb-2">
            <Sparkles className="w-3.5 h-3.5 text-primary fill-primary/30" />
            <span>Sweet Benefits</span>
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-gray-900 dark:text-white">
            Why you'll fall in love with MoneyPad
          </h2>
          <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
            Everything you need to unleash your creativity and get appreciated for your passion.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 w-full text-left">
          {/* Card 1: Reader Rewards */}
          <div className="group bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border-2 border-gray-100 dark:border-slate-800 hover:border-primary/50 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
            <div>
              <div className="w-14 h-14 bg-[#F5E9DA] dark:bg-amber-950/40 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <BookOpen className="w-7 h-7 text-primary" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300 mb-2">
                <BookOpen className="w-3 h-3 text-green-700 dark:text-green-300" />
                <span>For Readers</span>
              </div>
              <h3 className="font-extrabold text-xl text-gray-900 dark:text-gray-100 mb-2">
                Reader Rewards
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Earn real Reader Coins every minute you spend reading published chapters. Cash out smoothly directly to GCash or Maya!
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800 flex items-center gap-2 text-xs font-bold text-primary">
              <CheckCircle2 className="w-4 h-4" />
              <span>Earn while cozy reading</span>
            </div>
          </div>

          {/* Card 2: Author Royalties */}
          <div className="group bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border-2 border-[#F5E9DA] dark:border-amber-900/40 hover:border-accent/50 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-accent text-white text-[10px] font-black uppercase px-3 py-1 rounded-bl-xl">
              Popular
            </div>
            <div>
              <div className="w-14 h-14 bg-red-50 dark:bg-red-950/40 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <DollarSign className="w-7 h-7 text-accent" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 mb-2">
                <PenTool className="w-3 h-3 text-amber-700 dark:text-amber-300" />
                <span>For Writers</span>
              </div>
              <h3 className="font-extrabold text-xl text-gray-900 dark:text-gray-100 mb-2">
                Author Royalties
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Publish your stories, get verified, and earn royalties every 100 chapter views. Your words truly have value here!
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800 flex items-center gap-2 text-xs font-bold text-accent">
              <CheckCircle2 className="w-4 h-4" />
              <span>Instant payouts & stats</span>
            </div>
          </div>

          {/* Card 3: Lively Community */}
          <div className="group bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border-2 border-gray-100 dark:border-slate-800 hover:border-primary/50 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
            <div>
              <div className="w-14 h-14 bg-[#FAF9F6] dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <MessageSquare className="w-7 h-7 text-primary" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-stone-100 text-stone-800 dark:bg-slate-800 dark:text-slate-300 mb-2">
                <Users className="w-3 h-3 text-stone-700 dark:text-stone-300" />
                <span>Cozy Tribe</span>
              </div>
              <h3 className="font-extrabold text-xl text-gray-900 dark:text-gray-100 mb-2">
                Lively Community
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Chat in real time with fellow storytellers, react to passages, brainstorm twists, and grow your personal fanbase.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800 flex items-center gap-2 text-xs font-bold text-primary">
              <CheckCircle2 className="w-4 h-4" />
              <span>Interactive chapter reactions</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Cute Steps Section */}
      <section className="w-full bg-[#F5E9DA]/50 dark:bg-slate-900/70 border-2 border-amber-200/60 dark:border-slate-800 rounded-3xl p-6 sm:p-12 text-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white dark:bg-slate-800 text-stone-800 dark:text-stone-200 shadow-xs mb-3">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
          <span>Easy as 1, 2, 3!</span>
        </span>
        <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mb-8">
          How to start your MoneyPad journey
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xs border border-amber-100 dark:border-slate-700 flex flex-col items-center">
            <span className="w-10 h-10 rounded-full bg-primary text-white font-black text-lg flex items-center justify-center mb-4 shadow-sm">
              1
            </span>
            <div className="flex items-center gap-1.5 font-bold text-base text-gray-900 dark:text-white mb-1">
              <span>Join in seconds</span>
              <UserPlus className="w-4 h-4 text-primary" />
            </div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Create your free account, pick your favorite genres, and get a cozy warm welcome.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xs border border-amber-100 dark:border-slate-700 flex flex-col items-center">
            <span className="w-10 h-10 rounded-full bg-accent text-white font-black text-lg flex items-center justify-center mb-4 shadow-sm">
              2
            </span>
            <div className="flex items-center gap-1.5 font-bold text-base text-gray-900 dark:text-white mb-1">
              <span>Read or Pen Chapters</span>
              <PenTool className="w-4 h-4 text-accent" />
            </div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Browse trending serials or open our rich editor to write and publish your original stories.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xs border border-amber-100 dark:border-slate-700 flex flex-col items-center">
            <span className="w-10 h-10 rounded-full bg-amber-500 text-white font-black text-lg flex items-center justify-center mb-4 shadow-sm">
              3
            </span>
            <div className="flex items-center gap-1.5 font-bold text-base text-gray-900 dark:text-white mb-1">
              <span>Collect & Cash Out</span>
              <Wallet className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Watch your balance grow with reading coins and writer royalties, withdrawable via GCash/Maya!
            </p>
          </div>
        </div>
      </section>

      {/* Sweet Bottom CTA Card */}
      <section className="w-full bg-gradient-to-br from-[#47AA57] to-[#368b44] rounded-3xl sm:rounded-4xl p-8 sm:p-14 text-center text-white shadow-xl shadow-green-900/15 relative overflow-hidden">
        {/* Decorative SVG accents */}
        <Sparkles className="w-8 h-8 text-white/30 absolute top-4 left-6 animate-pulse select-none pointer-events-none" />
        <Heart className="w-8 h-8 text-white/30 fill-white/10 absolute bottom-6 right-8 animate-bounce select-none pointer-events-none" />
        <Star className="w-7 h-7 text-white/30 fill-white/10 absolute top-8 right-12 select-none pointer-events-none" />

        <div className="max-w-2xl mx-auto flex flex-col items-center relative z-10">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-extrabold bg-white/20 text-white backdrop-blur-xs mb-4">
            <PenTool className="w-3.5 h-3.5" />
            Your creative journey starts now
          </span>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4 tracking-tight leading-tight">
            Ready to write your next adventure?
          </h2>

          <p className="text-white/90 text-sm sm:text-base mb-8 max-w-lg leading-relaxed">
            Join thousands of writers and readers turning their love for storytelling into a fun, rewarding daily habit.
          </p>

          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-white text-primary hover:bg-[#F5E9DA] active:scale-95 font-black px-9 py-4 rounded-full shadow-lg text-base sm:text-lg transition-all cursor-pointer"
          >
            <span>Create Your Free Account</span>
            <ArrowRight className="w-5 h-5 text-primary" />
          </Link>
        </div>
      </section>
    </div>
  );
}

