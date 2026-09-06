import { useState } from 'react';
import { LoaderCircle, X } from 'lucide-react';
import http from '../../api/http';
import { useAuth, type User } from '../../auth/AuthProvider';
import { useFeedback } from '../feedback/feedback';
import { getApiErrorMessage } from '../../utils/apiError';

interface EditBioModalProps {
  onClose: () => void;
  onBioUpdated: (updatedUser: User) => void;
}

export const EditBioModal = ({ onClose, onBioUpdated }: EditBioModalProps) => {
  const { user, updateUser } = useAuth();
  const feedback = useFeedback();
  const [bio, setBio] = useState(user?.bio || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setIsSaving(true);
    try {
      const response = await http.put<{ user: User }>(`/users/${user.id}/profile`, {
        bio: bio.trim(),
      });
      const updatedUser = response.data.user;

      updateUser(updatedUser);
      onBioUpdated(updatedUser);
      feedback.success('Bio updated successfully.');
      onClose();
    } catch (error) {
      feedback.error(getApiErrorMessage(error, 'Failed to update bio.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-bio-title"
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-lg w-full p-6 relative"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          aria-label="Close edit bio dialog"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full transition-colors disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 id="edit-bio-title" className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Edit Bio
        </h2>

        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="author-bio" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Author Bio
              </label>
              <span className="text-xs text-gray-400">{bio.length} / 500</span>
            </div>
            <textarea
              id="author-bio"
              rows={4}
              maxLength={500}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="Tell readers about yourself, writing style, and updates..."
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-3 text-sm text-gray-900 dark:text-gray-100 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-green-600 transition disabled:opacity-60 disabled:cursor-not-allowed shadow-xs"
            >
              {isSaving && <LoaderCircle className="w-4 h-4 animate-spin" />}
              {isSaving ? 'Saving...' : 'Save Bio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditBioModal;
