import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import http from '../../api/http';
import { useAuth } from '../../auth/AuthProvider';
import { LoaderCircle } from 'lucide-react';
import { STORY_GENRES } from '../../constants/genres';
import { getApiErrorMessage } from '../../utils/apiError';
import { useFeedback } from '../../components/feedback/feedback';

export default function OnboardingPage() {
  const { user, isLoading, checkAuth } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(user?.onboardingStep || 1);
  const [gender, setGender] = useState('');
  const [birthday, setBirthday] = useState('');
  const [genres, setGenres] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [pendingStep, setPendingStep] = useState<number | null>(null);
  const feedback = useFeedback();

  useEffect(() => {
    if (user?.onboardingStep) {
      setStep(user.onboardingStep);
    }
  }, [user?.onboardingStep]);

  const handleGenderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPendingStep(1);
    try {
      await http.post(`/users/${user?.id}/onboarding/gender`, { gender });
      setStep(2);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Your gender selection could not be saved.'));
    } finally {
      setPendingStep(null);
    }
  };

  const handleBirthdaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPendingStep(2);
    try {
      await http.post(`/users/${user?.id}/onboarding/birthday`, { birthday });
      setStep(3);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Your birthday could not be saved.'));
    } finally {
      setPendingStep(null);
    }
  };

  const handleGenresSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (genres.length === 0) {
      setError('Please select at least one genre');
      return;
    }
    setError('');
    setPendingStep(3);
    try {
      await http.post(`/users/${user?.id}/onboarding/genres`, { preferredGenres: genres.join(',') });
      await http.post(`/users/${user?.id}/onboarding/complete`);
      await checkAuth(); // Refresh user state
      navigate('/explore');
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Your genre preferences could not be saved.'));
    } finally {
      setPendingStep(null);
    }
  };

  const toggleGenre = (genre: string) => {
    if (genres.includes(genre)) {
      setGenres(genres.filter(g => g !== genre));
    } else if (genres.length < 8) {
      setGenres([...genres, genre]);
    } else {
      feedback.warning('You can select up to eight genres.');
    }
  };

  if (isLoading) return <div className="text-center p-12">Loading setup...</div>;
  if (!user) return <div className="text-center p-12">Please log in to complete setup.</div>;

  return (
    <div className="max-w-md mx-auto mt-6 sm:mt-10 p-4 sm:p-6 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700">
      <h2 className="text-xl sm:text-2xl font-bold mb-2 text-center text-primary">Welcome, {user.username}!</h2>
      <p className="text-center mb-6 text-xs sm:text-sm text-gray-500">Let's set up your profile.</p>
      
      {error && <div role="alert" className="mb-4 text-accent text-center">{error}</div>}

      {step === 1 && (
        <form onSubmit={handleGenderSubmit}>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3">What is your gender?</label>
            <div className="space-y-2">
              {['Male', 'Female'].map((g) => (
                <label key={g} className="flex items-center space-x-2 p-2 border rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700">
                  <input type="radio" name="gender" value={g} checked={gender === g} onChange={() => setGender(g)} disabled={pendingStep === 1} required />
                  <span>{g}</span>
                </label>
              ))}
            </div>
          </div>
          <button type="submit" aria-busy={pendingStep === 1} className="flex w-full items-center justify-center gap-2 rounded bg-primary p-2 text-white transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-60" disabled={!gender || pendingStep === 1}>
            {pendingStep === 1 && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {pendingStep === 1 ? 'Saving...' : 'Next'}
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleBirthdaySubmit}>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-1">When is your birthday?</label>
            <input
              type="date"
              className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              disabled={pendingStep === 2}
              required
            />
          </div>
          <button type="submit" aria-busy={pendingStep === 2} className="flex w-full items-center justify-center gap-2 rounded bg-primary p-2 text-white transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-60" disabled={!birthday || pendingStep === 2}>
            {pendingStep === 2 && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {pendingStep === 2 ? 'Saving...' : 'Next'}
          </button>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={handleGenresSubmit}>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Select your favorite genres (up to 8)</label>
            <div className="flex flex-wrap gap-2">
              {STORY_GENRES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGenre(g)}
                  disabled={pendingStep === 3}
                  className={`px-3 py-1 rounded-full border text-sm transition ${
                    genres.includes(g) 
                      ? 'bg-primary border-primary text-white' 
                      : 'border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" aria-busy={pendingStep === 3} className="flex w-full items-center justify-center gap-2 rounded bg-primary p-2 text-white transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-60" disabled={genres.length === 0 || pendingStep === 3}>
            {pendingStep === 3 && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {pendingStep === 3 ? 'Finishing setup...' : 'Complete Setup'}
          </button>
        </form>
      )}
    </div>
  );
}
