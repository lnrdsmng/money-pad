import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import http from '../api/http';
import { UserCheck, UserPlus, BookOpen, Clock, LoaderCircle, Edit3, MessageSquare } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { SystemMessageInbox } from '../components/SystemMessageInbox';
import { GroupChat } from '../components/GroupChat';
import { VerifiedBadge } from '../components/common/VerifiedBadge';
import { UserListModal } from '../components/profile/UserListModal';
import { EditProfileModal } from '../components/profile/EditProfileModal';
import { AuthorWall } from '../components/profile/AuthorWall';
import { useFeedback } from '../components/feedback/feedback';
import { getApiErrorMessage } from '../utils/apiError';

export default function ProfilePage() {
  const { username } = useParams();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowPending, setIsFollowPending] = useState(false);
  const [activeTab, setActiveTab] = useState<'works' | 'wall'>('works');

  // Modals
  const [userListModal, setUserListModal] = useState<'followers' | 'following' | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const feedback = useFeedback();
  const isOwnProfile = currentUser?.username === username;

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setLoadError('');
        setIsFollowing(false);
        let foundUser: any = null;
        try {
          const userRes = await http.get(`/users/${username}`);
          foundUser = userRes.data;
        } catch {
          const searchRes = await http.get(`/users/search?query=${encodeURIComponent(username || '')}`);
          foundUser = Array.isArray(searchRes.data) ? searchRes.data[0] : searchRes.data.data?.[0];
        }

        if (foundUser) {
          setProfile(foundUser);

          const storiesRes = await http.get(`/authors/${foundUser.id}/stories/published`);
          setStories(Array.isArray(storiesRes.data) ? storiesRes.data : storiesRes.data.data || []);
          
          if (currentUser?.id && currentUser.id !== foundUser.id) {
            try {
              const followingRes = await http.get(`/users/${currentUser.id}/is-following/${foundUser.id}`);
              setIsFollowing(Boolean(followingRes.data.isFollowing));
            } catch {
              setIsFollowing(false);
            }
          }
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("Failed to load profile", err);
        setLoadError(getApiErrorMessage(err, 'The profile could not be loaded.'));
      } finally {
        setLoading(false);
      }
    };
    if (username) fetchProfile();
  }, [currentUser?.id, username]);

  const handleFollowToggle = async () => {
    if (!currentUser || !profile || isFollowPending) return;

    const previousValue = isFollowing;
    setIsFollowing(!previousValue);
    setIsFollowPending(true);

    try {
      await http.post(`/users/${currentUser.id}/${previousValue ? 'unfollow' : 'follow'}`, {
        followedId: profile.id,
      });
      setProfile((prev: any) => ({
        ...prev,
        followers: Math.max(0, (prev?.followers || 0) + (previousValue ? -1 : 1)),
      }));
      feedback.success(previousValue ? `Unfollowed @${profile.username}.` : `Following @${profile.username}.`);
    } catch (error) {
      setIsFollowing(previousValue);
      feedback.error(getApiErrorMessage(error, 'Your follow preference could not be updated.'));
    } finally {
      setIsFollowPending(false);
    }
  };

  if (loading) return <div className="text-center p-12">Loading profile...</div>;
  if (loadError) return <div role="alert" className="p-12 text-center text-red-600">{loadError}</div>;
  if (!profile) return <div className="text-center p-12">User not found</div>;

  return (
    <div className="bg-gray-50 dark:bg-slate-900 min-h-screen pb-12">
      {/* Cover Image */}
      <div className="h-40 sm:h-64 md:h-80 w-full bg-gray-300 dark:bg-slate-700 relative">
        {profile.coverImageUrl ? (
          <img src={profile.coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-gray-300 to-gray-400 dark:from-slate-700 dark:to-slate-800"></div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="relative -mt-14 sm:-mt-24 mb-6 sm:mb-8 flex flex-col md:flex-row items-center md:items-end justify-between gap-4">
          <div className="flex flex-col md:flex-row items-center md:items-end">
            <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 rounded-full border-4 border-white dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-800 shadow-md shrink-0">
              {profile.profileImageUrl ? (
                <img src={profile.profileImageUrl} alt={profile.username} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center text-3xl sm:text-4xl text-gray-500 font-bold">
                  {profile.username[0].toUpperCase()}
                </div>
              )}
            </div>
            <div className="mt-3 md:mt-0 md:ml-6 text-center md:text-left pb-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 flex flex-wrap items-center justify-center md:justify-start gap-1.5">
                @{profile.username}
                {profile.isVerified && <VerifiedBadge size={20} showText />}
                {profile.role === 'admin' && <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-medium">Admin</span>}
              </h1>

              {/* Followers & Following Counts */}
              <div className="flex items-center justify-center md:justify-start gap-4 mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                <button
                  type="button"
                  onClick={() => setUserListModal('followers')}
                  className="hover:text-primary transition-colors cursor-pointer"
                >
                  <strong className="text-gray-900 dark:text-gray-100">{profile.followers || 0}</strong> Followers
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => setUserListModal('following')}
                  className="hover:text-primary transition-colors cursor-pointer"
                >
                  <strong className="text-gray-900 dark:text-gray-100">{profile.following || 0}</strong> Following
                </button>
              </div>

              {profile.bio && <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-2 max-w-lg">{profile.bio}</p>}
            </div>
          </div>
          
          <div className="mt-2 md:mt-0 pb-2 flex justify-center">
            {!isOwnProfile && (
              <button
                type="button"
                onClick={handleFollowToggle}
                disabled={isFollowPending}
                aria-busy={isFollowPending}
                className={`flex items-center rounded-full px-5 sm:px-6 py-2 text-sm sm:text-base font-medium shadow transition disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer ${
                  isFollowing
                    ? 'border border-primary bg-white dark:bg-slate-800 text-primary hover:bg-green-50'
                    : 'bg-primary text-white hover:bg-green-600'
                }`}
              >
                {isFollowPending ? <LoaderCircle className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" /> : isFollowing ? <UserCheck className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> : <UserPlus className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />}
                {isFollowPending ? 'Updating...' : isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
            {isOwnProfile && (
              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                className="flex items-center gap-2 rounded-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-5 sm:px-6 py-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 shadow-xs hover:bg-gray-50 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
                Edit Profile
              </button>
            )}
          </div>
        </div>

        {isOwnProfile && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-8 sm:mb-12">
            <SystemMessageInbox />
            <GroupChat />
          </div>
        )}

        {/* Profile Tabs */}
        <div className="flex border-b border-gray-200 dark:border-slate-700 mb-6 gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('works')}
            className={`pb-3 font-semibold text-sm sm:text-base flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'works'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Published Works ({stories.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('wall')}
            className={`pb-3 font-semibold text-sm sm:text-base flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'wall'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Author Wall
          </button>
        </div>

        {activeTab === 'works' ? (
          <div className="mb-8">
            {stories.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-6">
                {stories.map(story => (
                  <Link key={story.id} to={`/story/${story.id}`} className="group block">
                    <div className="aspect-[2/3] rounded-lg overflow-hidden mb-2 sm:mb-3 bg-gray-200 dark:bg-slate-700 relative shadow-xs transition-transform group-hover:scale-[1.02]">
                      {story.coverImageUrl ? (
                        <img src={story.coverImageUrl} alt={story.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-2 sm:p-4 text-center">
                          <BookOpen className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400 mb-1 sm:mb-2" />
                          <span className="text-xs sm:text-sm font-medium text-gray-500 line-clamp-3">{story.title}</span>
                        </div>
                      )}
                    </div>
                    <h3 className="font-semibold text-xs sm:text-sm text-gray-900 dark:text-gray-100 line-clamp-1 group-hover:text-primary transition-colors">{story.title}</h3>
                    <div className="flex items-center text-[10px] sm:text-xs text-gray-500 mt-1">
                      <span className="bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded mr-1.5">{story.genre || 'General'}</span>
                      <Clock className="w-3 h-3 mr-1" />
                      <span>{new Date(story.created_at || story.createdAt).toLocaleDateString()}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 sm:py-12 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-xs">
                <p className="text-sm text-gray-500">This author hasn't published any stories yet.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-3xl">
            <AuthorWall authorId={profile.id} authorUsername={profile.username} />
          </div>
        )}
      </div>

      {/* Followers / Following List Modal */}
      {userListModal && (
        <UserListModal
          userId={profile.id}
          type={userListModal}
          onClose={() => setUserListModal(null)}
        />
      )}

      {/* Edit Profile Modal */}
      {showEditModal && (
        <EditProfileModal
          onClose={() => setShowEditModal(false)}
          onProfileUpdated={(updated) => setProfile(updated)}
        />
      )}
    </div>
  );
}
