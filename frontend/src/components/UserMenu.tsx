import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Settings, LogOut, ShieldAlert, LoaderCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useFeedback } from './feedback/feedback';

export default function UserMenu() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const feedback = useFeedback();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
      setIsOpen(false);
      navigate('/login');
      feedback.success('Signed out successfully.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
      >
        <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold">
          {user.username.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block">
          {user.username}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-md shadow-lg py-1 border border-gray-200 dark:border-slate-700 z-50">
          <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-700">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.username}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
          </div>
          
          {user.role === 'admin' && (
            <Link 
              to="/admin" 
              className="flex items-center px-4 py-2 text-sm text-accent hover:bg-gray-100 dark:hover:bg-slate-700 font-medium"
              onClick={() => setIsOpen(false)}
            >
              <ShieldAlert size={16} className="mr-2" />
              Admin Panel
            </Link>
          )}

          <Link 
            to="/profile" 
            className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
            onClick={() => setIsOpen(false)}
          >
            <User size={16} className="mr-2" />
            My Profile
          </Link>
          
          <button 
            className="flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-not-allowed opacity-50"
            disabled
          >
            <Settings size={16} className="mr-2" />
            Settings
          </button>
          
          <div className="border-t border-gray-100 dark:border-slate-700 my-1"></div>
          
          <button 
            onClick={handleLogout}
            disabled={isLoggingOut}
            aria-busy={isLoggingOut}
            className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            {isLoggingOut ? <LoaderCircle size={16} className="mr-2 animate-spin" /> : <LogOut size={16} className="mr-2" />}
            {isLoggingOut ? 'Signing out...' : 'Logout'}
          </button>
        </div>
      )}
    </div>
  );
}
