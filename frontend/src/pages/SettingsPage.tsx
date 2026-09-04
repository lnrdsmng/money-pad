import { useState } from 'react';
import { User, Lock, Moon, Sun, Check, LoaderCircle } from 'lucide-react';
import http from '../api/http';
import { useAuth } from '../auth/AuthProvider';
import { STORY_GENRES } from '../constants/genres';
import { useFeedback } from '../components/feedback/feedback';
import { getApiErrorMessage } from '../utils/apiError';

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const feedback = useFeedback();

  // Username & Genres state
  const [username, setUsername] = useState(user?.username || '');
  const [selectedGenres, setSelectedGenres] = useState<string[]>(() => {
    if (!user?.preferredGenres) return [];
    if (typeof user.preferredGenres === 'string') {
      return user.preferredGenres.split(',').map((g: string) => g.trim()).filter(Boolean);
    }
    return Array.isArray(user.preferredGenres) ? user.preferredGenres : [];
  });
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Appearance / Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark') ||
      localStorage.getItem('theme') === 'dark';
  });

  const toggleDarkMode = () => {
    const nextMode = !isDarkMode;
    setIsDarkMode(nextMode);
    if (nextMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleToggleGenre = (genre: string) => {
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(selectedGenres.filter((g) => g !== genre));
    } else {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  const handleUpdateProfileSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingSettings(true);
    try {
      const res = await http.put('/users/settings', {
        username: username.trim(),
        preferredGenres: selectedGenres.join(','),
      });
      if (res.data.user) {
        updateUser(res.data.user);
      }
      feedback.success('Account settings saved successfully.');
    } catch (error) {
      feedback.error(getApiErrorMessage(error, 'Failed to update settings.'));
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      feedback.error('New passwords do not match.');
      return;
    }

    // Password strength check
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      feedback.error('Password must contain at least one uppercase letter, one lowercase letter, and one number.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await http.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      feedback.success('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      feedback.error(getApiErrorMessage(error, 'Failed to change password.'));
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-8 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Account Settings</h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">Manage your account preferences, password, and genres</p>
      </div>

      {/* SECTION 1: ACCOUNT PREFERENCES */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700 shadow-xs">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-primary" />
          Account Details
        </h2>

        <form onSubmit={handleUpdateProfileSettings} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Username
            </label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={50}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full sm:w-80 p-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Preferred Reading Genres
            </label>
            <p className="text-xs text-gray-500 mb-3">Select genres you love to customize your recommendations</p>
            <div className="flex flex-wrap gap-2">
              {STORY_GENRES.map((genre) => {
                const selected = selectedGenres.includes(genre);
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => handleToggleGenre(genre)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                      selected
                        ? 'bg-primary text-white shadow-xs'
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {selected && <Check className="w-3 h-3" />}
                    {genre}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isUpdatingSettings}
              className="px-5 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-green-600 transition flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
            >
              {isUpdatingSettings && <LoaderCircle className="w-4 h-4 animate-spin" />}
              {isUpdatingSettings ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: CHANGE PASSWORD */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700 shadow-xs">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
          <Lock className="w-5 h-5 text-primary" />
          Security & Password
        </h2>

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Current Password
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              New Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
              placeholder="Min. 8 characters, with Aa1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isChangingPassword || !newPassword}
              className="px-5 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-green-600 transition flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
            >
              {isChangingPassword && <LoaderCircle className="w-4 h-4 animate-spin" />}
              {isChangingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 3: APPEARANCE */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700 shadow-xs">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
          {isDarkMode ? <Moon className="w-5 h-5 text-indigo-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
          Appearance
        </h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Dark Mode</p>
            <p className="text-xs text-gray-500">Switch between light and dark themes</p>
          </div>

          <button
            type="button"
            onClick={toggleDarkMode}
            className={`w-14 h-8 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
              isDarkMode ? 'bg-primary justify-end' : 'bg-gray-300 justify-start'
            }`}
          >
            <div className="bg-white w-6 h-6 rounded-full shadow-md transform transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}
