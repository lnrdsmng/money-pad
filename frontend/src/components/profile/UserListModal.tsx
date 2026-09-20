import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, UserCheck, UserPlus, LoaderCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import http from '../../api/http';
import { useAuth } from '../../auth/AuthProvider';
import { VerifiedBadge } from '../common/VerifiedBadge';
import { useFeedback } from '../feedback/feedback';
import { UserAvatar } from '../common/UserAvatar';

interface UserListModalProps {
  userId: string;
  type: 'followers' | 'following';
  onClose: () => void;
}

export const UserListModal = ({ userId, type, onClose }: UserListModalProps) => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const feedback = useFeedback();
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', userId, type],
    queryFn: async () => {
      const res = await http.get(`/users/${userId}/${type}`);
      return res.data;
    },
    enabled: !!userId,
  });

  const handleToggleFollow = async (targetUser: any) => {
    if (!currentUser) {
      feedback.error('Please log in to follow users.');
      return;
    }
    if (targetUser.id === currentUser.id) return;

    setPendingUserId(targetUser.id);
    try {
      const isCurrentlyFollowing = Boolean(targetUser.isFollowing);

      if (isCurrentlyFollowing) {
        await http.post(`/users/${currentUser.id}/unfollow`, { followedId: targetUser.id });
        feedback.success(`Unfollowed ${targetUser.username}`);
      } else {
        await http.post(`/users/${currentUser.id}/follow`, { followedId: targetUser.id });
        feedback.success(`Following ${targetUser.username}`);
      }

      queryClient.setQueryData<any[]>(['users', userId, type], (current = []) => current.map((listedUser) => (
        listedUser.id === targetUser.id
          ? { ...listedUser, isFollowing: !isCurrentlyFollowing }
          : listedUser
      )));
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch {
      feedback.error('Could not update follow status.');
    } finally {
      setPendingUserId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 relative flex flex-col max-h-[85vh]">
        <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-700 pb-3 mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 capitalize">
            {type}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {isLoading ? (
            <div className="text-center py-8 text-sm text-gray-500">Loading {type}...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500">No {type} found.</div>
          ) : (
            users.map((u: any) => (
              <div
                key={u.id}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <Link
                  to={`/profile/${u.username}`}
                  onClick={onClose}
                  className="flex items-center gap-3 min-w-0"
                >
                  <UserAvatar username={u.username || 'User'} imageUrl={u.profileImageUrl} className="h-10 w-10 text-sm" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                        {u.username}
                      </span>
                      {u.isVerified && <VerifiedBadge size={14} />}
                    </div>
                    {u.bio && (
                      <p className="text-xs text-gray-500 truncate max-w-[200px]">{u.bio}</p>
                    )}
                  </div>
                </Link>

                {currentUser && currentUser.id !== u.id && (
                  <button
                    onClick={() => handleToggleFollow(u)}
                    disabled={pendingUserId === u.id}
                    className={`px-3 py-1 text-xs font-medium border border-primary rounded-full transition-colors shrink-0 flex items-center gap-1 disabled:opacity-60 ${
                      u.isFollowing ? 'bg-primary text-white hover:bg-primary-dark' : 'text-primary hover:bg-primary hover:text-white'
                    }`}
                  >
                    {pendingUserId === u.id ? (
                      <LoaderCircle className="w-3 h-3 animate-spin" />
                    ) : (
                      u.isFollowing ? <UserCheck className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />
                    )}
                    {u.isFollowing ? 'Followed' : 'Follow'}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default UserListModal;
