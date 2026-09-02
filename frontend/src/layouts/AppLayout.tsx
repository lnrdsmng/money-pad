import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import BottomNavBar from '../components/BottomNavBar';
import UserMenu from '../components/UserMenu';
import { DailyLoginRewardPanel } from '../components/DailyLoginRewardPanel';

export default function AppLayout() {
  const { user } = useAuth();
  const location = useLocation();
  
  const isImmersivePage = location.pathname.includes('/read/') || location.pathname.includes('/edit');

  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-white border-b border-gray-200 dark:bg-slate-900 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex-shrink-0 flex items-center text-primary font-bold text-xl">
                MoneyPad
              </Link>
              
              {user && (
                <nav className="hidden md:flex ml-10 space-x-8">
                  <Link to="/explore" className={`text-sm font-medium ${location.pathname.startsWith('/explore') ? 'text-primary' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'}`}>Explore</Link>
                  <Link to="/writer" className={`text-sm font-medium ${location.pathname.startsWith('/writer') ? 'text-primary' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'}`}>Write</Link>
                  <Link to="/earnings" className={`text-sm font-medium ${location.pathname.startsWith('/earnings') ? 'text-primary' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'}`}>Earnings</Link>
                  {user.role === 'admin' && (
                    <Link to="/admin" className={`text-sm font-medium ${location.pathname.startsWith('/admin') ? 'text-accent font-bold' : 'text-accent/80 hover:text-accent dark:text-red-400'}`}>Admin Panel</Link>
                  )}
                </nav>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              {!user ? (
                <>
                  <Link to="/login" className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white font-medium text-sm">
                    Login
                  </Link>
                  <Link to="/register" className="bg-primary hover:opacity-90 text-white font-medium px-4 py-2 rounded-md text-sm transition-opacity">
                    Sign up
                  </Link>
                </>
              ) : (
                <UserMenu />
              )}
            </div>
          </div>
        </div>
      </header>

      {user && user.role !== 'admin' && !isImmersivePage && <DailyLoginRewardPanel />}
      
      <main className={`flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 ${user && !isImmersivePage ? 'pb-20 md:pb-8' : ''}`}>
        <Outlet />
      </main>

      <footer className={`bg-white border-t border-gray-200 p-4 text-center text-sm text-gray-500 dark:bg-slate-900 dark:border-slate-800 ${user && !isImmersivePage ? 'mb-16 md:mb-0' : ''}`}>
        © {new Date().getFullYear()} MoneyPad. All rights reserved.
      </footer>
      
      <BottomNavBar />
    </div>
  );
}
