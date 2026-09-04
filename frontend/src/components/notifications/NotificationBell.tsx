import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Heart,
  UserPlus,
  BookOpen,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  Gift,
  Info,
} from 'lucide-react';
import http from '../../api/http';
import { useAuth } from '../../auth/AuthProvider';

export const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Unread count
  const { data: countData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await http.get('/notifications/unread-count');
      return res.data;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Notifications list
  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: async () => {
      const res = await http.get('/notifications');
      return res.data;
    },
    enabled: isOpen && !!user,
  });

  const unreadCount = Number(countData?.count || 0);

  const markSingleReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await http.put(`/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await http.post('/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      refetch();
    },
  });

  const handleNotificationClick = (item: any) => {
    if (!item.isRead) {
      markSingleReadMutation.mutate(item.id);
    }
    setIsOpen(false);

    // Deep link navigation
    if (item.type === 'VERIFIED') {
      navigate('/writer/verification');
    } else if (item.type === 'REFERRAL_REWARD' || item.type === 'EARNINGS') {
      navigate('/earnings');
    } else if (item.storyId && item.partId) {
      navigate(`/story/${item.storyId}/read/${item.partId}`);
    } else if (item.storyId) {
      navigate(`/story/${item.storyId}`);
    } else if (item.actorName) {
      navigate(`/profile/${item.actorName}`);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'LIKE':
      case 'CONVERSATION_LIKE':
        return <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />;
      case 'FOLLOW':
        return <UserPlus className="w-4 h-4 text-blue-500" />;
      case 'NEW_STORY':
      case 'NEW_PART':
      case 'READ':
        return <BookOpen className="w-4 h-4 text-green-500" />;
      case 'REVIEW':
      case 'CONVERSATION':
      case 'REPLY':
      case 'MENTION':
        return <MessageSquare className="w-4 h-4 text-purple-500" />;
      case 'VERIFIED':
        return <ShieldCheck className="w-4 h-4 text-emerald-500" />;
      case 'WELCOME':
        return <Sparkles className="w-4 h-4 text-amber-500" />;
      case 'REFERRAL':
      case 'REFERRAL_REWARD':
        return <Gift className="w-4 h-4 text-amber-500" />;
      default:
        return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) refetch();
        }}
        className="relative p-2 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-slate-800 transition-colors focus:outline-none cursor-pointer"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
            <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
              Notifications
              {unreadCount > 0 && (
                <span className="text-xs font-normal text-rose-500">({unreadCount} new)</span>
              )}
            </h3>

            {notifications.some((n: any) => !n.isRead) && (
              <button
                type="button"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="text-xs text-primary hover:underline flex items-center gap-1 font-medium disabled:opacity-50 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800">
            {isLoading ? (
              <div className="p-6 text-center text-xs text-gray-500">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500">
                <Bell className="w-8 h-8 text-gray-300 dark:text-slate-700 mx-auto mb-2" />
                No notifications yet.
              </div>
            ) : (
              notifications.map((item: any) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3.5 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer flex items-start gap-3 ${
                    !item.isRead ? 'bg-primary/5 dark:bg-primary/10' : ''
                  }`}
                >
                  <div className="p-2 rounded-full bg-gray-100 dark:bg-slate-800 shrink-0 mt-0.5">
                    {getNotificationIcon(item.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-800 dark:text-gray-200 line-clamp-2 leading-relaxed">
                      <strong className="font-semibold text-gray-900 dark:text-gray-100">
                        {item.actorName || 'System'}
                      </strong>{' '}
                      {item.content || 'interacted with your profile.'}
                    </p>
                    {item.storyTitle && (
                      <p className="text-[11px] text-gray-400 truncate mt-0.5 font-medium">
                        "{item.storyTitle}"
                      </p>
                    )}
                    <span className="text-[10px] text-gray-400 block mt-1">
                      {item.timestamp ? new Date(Number(item.timestamp)).toLocaleString() : ''}
                    </span>
                  </div>

                  {!item.isRead && (
                    <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
