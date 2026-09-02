import { Link, useLocation } from 'react-router-dom';
import { Compass, PenTool, Wallet, UserCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';

export default function BottomNavBar() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return null;

  // Hide bottom nav on reader and editor pages
  if (
    location.pathname.includes('/read/') || 
    location.pathname.includes('/edit')
  ) {
    return null;
  }

  const tabs = [
    { name: 'Explore', path: '/explore', icon: Compass },
    { name: 'Write', path: '/writer', icon: PenTool },
    { name: 'Earnings', path: '/earnings', icon: Wallet },
    { name: 'Profile', path: '/profile', icon: UserCircle },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 dark:bg-slate-900 dark:border-slate-800 z-50">
      <div className="flex justify-around items-center h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          // Check if path is active (handle subroutes for profile and writer)
          const isActive = location.pathname.startsWith(tab.path);
          
          return (
            <Link
              key={tab.name}
              to={tab.path}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                isActive 
                  ? 'text-primary' 
                  : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
              }`}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{tab.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
