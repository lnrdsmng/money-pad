import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-6xl mb-6">
        Welcome to MoneyPad
      </h1>
      <p className="mt-4 max-w-2xl text-xl text-gray-500 dark:text-gray-300 mx-auto mb-10">
        The simplest way to create, share, and monetize your stories. Turn your creativity into opportunity today.
      </p>
      <div className="flex gap-4">
        <Link
          to="/register"
          className="bg-primary hover:opacity-90 text-white font-semibold px-8 py-3 rounded-lg shadow-sm transition-opacity text-lg"
        >
          Get Started
        </Link>
        <Link
          to="/login"
          className="bg-white hover:bg-gray-50 text-gray-900 font-semibold px-8 py-3 rounded-lg border border-gray-300 shadow-sm transition-colors text-lg dark:bg-slate-800 dark:text-white dark:border-slate-700 dark:hover:bg-slate-700"
        >
          Login
        </Link>
      </div>
    </div>
  );
}
