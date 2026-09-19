import { Link, useLocation } from 'react-router-dom';
import { Compass, MessageCircle, PenTool, Wallet, UserCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useDailyLoginReward } from '../hooks/useDailyLoginReward';
import { useCommunityUnread } from '../hooks/useCommunityUnread';
import { UserAvatar } from './common/UserAvatar';

export default function BottomNavBar() {
  const { user } = useAuth();
  const location = useLocation();
  const { hasAvailableReward } = useDailyLoginReward();
  const communityUnread = useCommunityUnread();

  if (!user) return null;

  // Hide bottom nav on reader, editor, admin, and onboarding pages
  if (
    location.pathname.includes('/read/') || 
    location.pathname.includes('/edit') ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/onboarding')
  ) {
    return null;
  }

  const tabs = [
    { name: 'Explore', path: '/explore', icon: Compass, hasBadge: hasAvailableReward },
    { name: 'Community', path: '/community', icon: MessageCircle, hasBadge: false, count: communityUnread },
    { name: 'Write', path: '/writer', icon: PenTool, hasBadge: false },
    { name: 'Earnings', path: '/earnings', icon: Wallet, hasBadge: hasAvailableReward },
    { name: 'Profile', path: '/profile', icon: UserCircle, hasBadge: false },
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
              className={`relative flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                isActive 
                  ? 'text-primary' 
                  : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
              }`}
            >
              <div className="relative">
                {tab.name === 'Profile' ? (
                  <UserAvatar username={user.username} imageUrl={user.profileImageUrl} className="h-[22px] w-[22px] text-[10px]" />
                ) : (
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                )}
                {tab.hasBadge && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent ring-2 ring-white dark:ring-slate-900 animate-pulse" />
                )}
                {'count' in tab && Number(tab.count) > 0 && (
                  <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
                    {Number(tab.count) > 99 ? '99+' : tab.count}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium tracking-tight">{tab.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
