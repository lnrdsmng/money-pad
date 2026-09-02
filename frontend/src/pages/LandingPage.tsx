import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center py-12 sm:py-20 px-3 sm:px-4 text-center">
      <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white md:text-6xl mb-4 sm:mb-6">
        Welcome to MoneyPad
      </h1>
      <p className="mt-2 sm:mt-4 max-w-2xl text-base sm:text-xl text-gray-500 dark:text-gray-300 mx-auto mb-8 sm:mb-10">
        The simplest way to create, share, and monetize your stories. Turn your creativity into opportunity today.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto max-w-xs sm:max-w-none">
        <Link
          to="/register"
          className="w-full sm:w-auto bg-primary hover:opacity-90 text-white font-semibold px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg shadow-sm transition-opacity text-base sm:text-lg text-center"
        >
          Get Started
        </Link>
        <Link
          to="/login"
          className="w-full sm:w-auto bg-white hover:bg-gray-50 text-gray-900 font-semibold px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg border border-gray-300 shadow-sm transition-colors text-base sm:text-lg dark:bg-slate-800 dark:text-white dark:border-slate-700 dark:hover:bg-slate-700 text-center"
        >
          Login
        </Link>
      </div>
    </div>
  );
}
