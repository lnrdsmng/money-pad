import { useState } from 'react';
import { X, Upload, LoaderCircle } from 'lucide-react';
import http from '../../api/http';
import { useAuth } from '../../auth/AuthProvider';
import { useFeedback } from '../feedback/feedback';
import { getApiErrorMessage } from '../../utils/apiError';

interface EditProfileModalProps {
  onClose: () => void;
  onProfileUpdated: (updatedUser: any) => void;
}

export const EditProfileModal = ({ onClose, onProfileUpdated }: EditProfileModalProps) => {
  const { user, updateUser } = useAuth();
  const feedback = useFeedback();

  const [bio, setBio] = useState(user?.bio || '');
  const [profileImageUrl, setProfileImageUrl] = useState(user?.profileImageUrl || '');
  const [coverImageUrl, setCoverImageUrl] = useState(user?.coverImageUrl || '');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleFileUpload = async (file: File, type: 'avatar' | 'cover') => {
    const formData = new FormData();
    formData.append('image', file);

    if (type === 'avatar') setIsUploadingAvatar(true);
    else setIsUploadingCover(true);

    try {
      const res = await http.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (type === 'avatar') {
        setProfileImageUrl(res.data.url);
      } else {
        setCoverImageUrl(res.data.url);
      }
      feedback.success(`${type === 'avatar' ? 'Profile picture' : 'Cover image'} uploaded.`);
    } catch (error) {
      feedback.error(getApiErrorMessage(error, 'Image upload failed.'));
    } finally {
      if (type === 'avatar') setIsUploadingAvatar(false);
      else setIsUploadingCover(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    try {
      const res = await http.put(`/users/${user.id}/profile`, {
        bio: bio.trim(),
        profileImageUrl: profileImageUrl.trim() || null,
        coverImageUrl: coverImageUrl.trim() || null,
      });

      const updated = res.data.user || res.data;
      updateUser(updated);
      onProfileUpdated(updated);
      feedback.success('Profile updated successfully.');
      onClose();
    } catch (error) {
      feedback.error(getApiErrorMessage(error, 'Failed to update profile.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-lg w-full p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Edit Profile</h2>

        <form onSubmit={handleSave} className="space-y-5">
          {/* Avatar */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Profile Photo
            </label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden border border-gray-200 dark:border-slate-600 shrink-0">
                {profileImageUrl ? (
                  <img src={profileImageUrl} alt="Avatar preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-bold text-gray-400">
                    {user?.username?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  value={profileImageUrl}
                  onChange={(e) => setProfileImageUrl(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
                />
                <label className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-xs font-medium text-gray-700 dark:text-gray-200 rounded-lg cursor-pointer transition">
                  {isUploadingAvatar ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {isUploadingAvatar ? 'Uploading...' : 'Upload File'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={isUploadingAvatar}
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleFileUpload(e.target.files[0], 'avatar');
                    }}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Cover Banner */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Cover Banner
            </label>
            <div className="space-y-2">
              {coverImageUrl && (
                <div className="h-24 w-full rounded-lg overflow-hidden bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600">
                  <img src={coverImageUrl} alt="Cover preview" className="w-full h-full object-cover" />
                </div>
              )}
              <input
                type="url"
                placeholder="https://example.com/cover.jpg"
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
              />
              <label className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-xs font-medium text-gray-700 dark:text-gray-200 rounded-lg cursor-pointer transition">
                {isUploadingCover ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {isUploadingCover ? 'Uploading...' : 'Upload Banner'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={isUploadingCover}
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileUpload(e.target.files[0], 'cover');
                  }}
                />
              </label>
            </div>
          </div>

          {/* Bio */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Author Bio
              </label>
              <span className="text-xs text-gray-400">{bio.length} / 500</span>
            </div>
            <textarea
              rows={4}
              maxLength={500}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell readers about yourself, writing style, and updates..."
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-3 text-sm text-gray-900 dark:text-gray-100 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-green-600 transition disabled:opacity-60 disabled:cursor-not-allowed shadow-xs"
            >
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProfileModal;
