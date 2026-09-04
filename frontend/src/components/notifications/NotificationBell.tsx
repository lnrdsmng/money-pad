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
  Mail,
  MailOpen,
  Pin,
} from 'lucide-react';
import http from '../../api/http';
import { useAuth } from '../../auth/AuthProvider';
import { WithdrawalFlowModal } from '../WithdrawalFlowModal';
import { useFeedback } from '../feedback/feedback';
import { getApiErrorMessage } from '../../utils/apiError';

export const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const feedback = useFeedback();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'activity' | 'system'>('activity');
  const [selectedWithdrawalId, setSelectedWithdrawalId] = useState<string | null>(null);
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

  // Activity Unread count
  const { data: countData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await http.get('/notifications/unread-count');
      return res.data;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Activity Notifications list
  const { data: notifications = [], isLoading: loadingActivity, refetch: refetchActivity } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: async () => {
      const res = await http.get('/notifications');
      return res.data;
    },
    enabled: isOpen && activeTab === 'activity' && !!user,
  });

  // System Messages list
  const { data: systemMessages = [], isLoading: loadingSystem, refetch: refetchSystem } = useQuery({
    queryKey: ['systemMessages', user?.id],
    queryFn: async () => {
      const res = await http.get(`/users/${user?.id}/system-messages`);
      return res.data;
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  const unreadActivityCount = Number(countData?.count || 0);
  const unreadSystemCount = (systemMessages || []).filter((m: any) => !m.is_read).length;
  const totalUnreadCount = unreadActivityCount + unreadSystemCount;

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
      refetchActivity();
    },
  });

  const markSystemReadMutation = useMutation({
    mutationFn: (id: string) => http.put(`/system-messages/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemMessages', user?.id] });
    },
    onError: (error) => feedback.error(getApiErrorMessage(error, 'The message could not be marked as read.')),
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
        return <BookOpen className="w-4 h-4 text-primary" />;
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
          if (!isOpen) {
            refetchActivity();
            refetchSystem();
          }
        }}
        className="relative p-2 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-slate-800 transition-colors focus:outline-none cursor-pointer"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {totalUnreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white shadow-xs">
            {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Header with segmented tabs */}
          <div className="px-4 pt-3 pb-2 border-b border-gray-100 dark:border-slate-800">
            <div className="flex justify-between items-center mb-2.5">
              <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                Notifications
                {totalUnreadCount > 0 && (
                  <span className="text-xs font-semibold text-accent">({totalUnreadCount} new)</span>
                )}
              </h3>

              {activeTab === 'activity' && notifications.some((n: any) => !n.isRead) && (
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

            {/* Segmented Tab Controls */}
            <div className="grid grid-cols-2 p-1 bg-gray-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('activity')}
                className={`py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'activity'
                    ? 'bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 shadow-xs'
                    : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <span>Activity</span>
                {unreadActivityCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-accent text-white text-[10px]">
                    {unreadActivityCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('system')}
                className={`py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'system'
                    ? 'bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 shadow-xs'
                    : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <span>System Notices</span>
                {unreadSystemCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-accent text-white text-[10px]">
                    {unreadSystemCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Activity Tab Content */}
          {activeTab === 'activity' && (
            <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800">
              {loadingActivity ? (
                <div className="p-6 text-center text-xs text-gray-500">Loading notifications...</div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500">
                  <Bell className="w-8 h-8 text-gray-300 dark:text-slate-700 mx-auto mb-2" />
                  No activity notifications yet.
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
                      <span className="w-2 h-2 rounded-full bg-accent shrink-0 mt-1.5" />
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* System Notices Tab Content */}
          {activeTab === 'system' && (
            <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800">
              {loadingSystem ? (
                <div className="p-6 text-center text-xs text-gray-500">Loading notices...</div>
              ) : systemMessages.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500">
                  <Mail className="w-8 h-8 text-gray-300 dark:text-slate-700 mx-auto mb-2" />
                  No system messages yet.
                </div>
              ) : (
                systemMessages.map((msg: any) => (
                  <div
                    key={msg.id}
                    className={`p-3.5 transition-colors ${
                      !msg.is_read
                        ? 'bg-[#F5E9DA]/30 dark:bg-amber-950/20'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-800/60'
                    } ${msg.is_pinned ? 'border-l-4 border-l-primary' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start space-x-2.5 min-w-0">
                        {msg.is_pinned ? (
                          <Pin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        ) : msg.is_read ? (
                          <MailOpen className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                        ) : (
                          <Mail className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                        )}

                        <div className="min-w-0">
                          <h4
                            className={`text-xs ${
                              msg.is_read
                                ? 'font-medium text-gray-700 dark:text-gray-300'
                                : 'font-bold text-gray-900 dark:text-gray-100'
                            }`}
                          >
                            {msg.title}
                          </h4>
                          <p className="text-[11px] sm:text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed break-words">
                            {msg.content}
                          </p>

                          {msg.action_type === 'watch_ads_prompt' && msg.withdrawal_request_id && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsOpen(false);
                                setSelectedWithdrawalId(msg.withdrawal_request_id);
                              }}
                              className="mt-2 px-3 py-1 bg-primary text-white rounded-lg text-[11px] font-semibold hover:bg-primary-hover transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                            >
                              <Sparkles className="w-3 h-3" />
                              View Payout & Waive Fee
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10px] text-gray-400">
                          {new Date(msg.created_at).toLocaleDateString()}
                        </span>
                        {!msg.is_read && (
                          <button
                            type="button"
                            disabled={markSystemReadMutation.isPending}
                            onClick={() => markSystemReadMutation.mutate(msg.id)}
                            className="text-[10px] font-semibold text-primary hover:underline cursor-pointer disabled:opacity-50"
                          >
                            {markSystemReadMutation.isPending ? '...' : 'Mark read'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {selectedWithdrawalId && (
        <WithdrawalFlowModal
          requestId={selectedWithdrawalId}
          onClose={() => setSelectedWithdrawalId(null)}
        />
      )}
    </div>
  );
};

export default NotificationBell;
