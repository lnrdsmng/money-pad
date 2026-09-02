import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import http from '../api/http';
import { UserPlus, BookOpen, Clock } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { SystemMessageInbox } from '../components/SystemMessageInbox';
import { GroupChat } from '../components/GroupChat';

export default function ProfilePage() {
  const { username } = useParams();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // We find user ID from username
  const isOwnProfile = currentUser?.username === username;

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        // Step 1: Find user by username
        const searchRes = await http.get(`/users/search?query=${username}`);
        const foundUser = Array.isArray(searchRes.data) ? searchRes.data[0] : searchRes.data.data?.[0];

        if (foundUser) {
          setProfile(foundUser);
          // Step 2: Fetch their published stories
          const storiesRes = await http.get(`/authors/${foundUser.id}/stories/published`);
          setStories(Array.isArray(storiesRes.data) ? storiesRes.data : storiesRes.data.data || []);
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("Failed to load profile", err);
      } finally {
        setLoading(false);
      }
    };
    if (username) fetchProfile();
  }, [username]);

  if (loading) return <div className="text-center p-12">Loading profile...</div>;
  if (!profile) return <div className="text-center p-12">User not found</div>;

  return (
    <div className="bg-gray-50 min-h-screen pb-12">
      {/* Cover Image */}
      <div className="h-64 md:h-80 w-full bg-gray-300 relative">
        {profile.coverImageUrl ? (
          <img src={profile.coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-gray-300 to-gray-400"></div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-24 mb-8 flex flex-col md:flex-row items-center md:items-end justify-between">
          <div className="flex flex-col md:flex-row items-center md:items-end">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white overflow-hidden bg-white shadow-md">
              {profile.profileImageUrl ? (
                <img src={profile.profileImageUrl} alt={profile.username} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center text-4xl text-gray-500 font-bold">
                  {profile.username[0].toUpperCase()}
                </div>
              )}
            </div>
            <div className="mt-4 md:mt-0 md:ml-6 text-center md:text-left pb-2">
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                @{profile.username}
                {profile.role === 'admin' && <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-medium">Admin</span>}
              </h1>
              {profile.bio && <p className="text-gray-600 mt-2 max-w-lg">{profile.bio}</p>}
            </div>
          </div>
          
          <div className="mt-6 md:mt-0 pb-2">
            {!isOwnProfile && (
              <button className="flex items-center px-6 py-2 bg-primary text-white rounded-full font-medium hover:bg-green-600 transition shadow">
                <UserPlus className="w-5 h-5 mr-2" />
                Follow
              </button>
            )}
            {isOwnProfile && (
              <Link to="/settings" className="flex items-center px-6 py-2 bg-white text-gray-700 border border-gray-300 rounded-full font-medium hover:bg-gray-50 transition shadow-sm">
                Edit Profile
              </Link>
            )}
          </div>
        </div>

        {isOwnProfile && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            <SystemMessageInbox />
            <GroupChat />
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <BookOpen className="w-6 h-6 mr-2 text-primary" />
            Published Works ({stories.length})
          </h2>
          
          {stories.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {stories.map(story => (
                <Link key={story.id} to={`/story/${story.id}`} className="group block">
                  <div className="aspect-[2/3] rounded-lg overflow-hidden mb-3 bg-gray-200 relative shadow-sm transition-transform group-hover:scale-[1.02]">
                    {story.coverImageUrl ? (
                      <img src={story.coverImageUrl} alt={story.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                        <BookOpen className="w-8 h-8 text-gray-400 mb-2" />
                        <span className="text-sm font-medium text-gray-500 line-clamp-3">{story.title}</span>
                      </div>
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-900 line-clamp-1 group-hover:text-primary transition-colors">{story.title}</h3>
                  <div className="flex items-center text-xs text-gray-500 mt-1">
                    <span className="bg-gray-100 px-2 py-0.5 rounded mr-2">{story.genre || 'General'}</span>
                    <Clock className="w-3 h-3 mr-1" />
                    <span>{new Date(story.created_at || story.createdAt).toLocaleDateString()}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-100 shadow-sm">
              <p className="text-gray-500">This author hasn't published any stories yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
