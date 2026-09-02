import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import http from '../../api/http';
import { useAuth } from '../../auth/AuthProvider';

export default function OnboardingPage() {
  const { user, isLoading, checkAuth } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(user?.onboardingStep || 1);
  const [gender, setGender] = useState('');
  const [birthday, setBirthday] = useState('');
  const [genres, setGenres] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.onboardingStep) {
      setStep(user.onboardingStep);
    }
  }, [user?.onboardingStep]);

  const availableGenres = ['Romance', 'Fantasy', 'Sci-Fi', 'Mystery', 'Thriller', 'Horror', 'Historical', 'Action', 'Adventure'];

  const handleGenderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await http.post(`/users/${user?.id}/onboarding/gender`, { gender });
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error saving gender');
    }
  };

  const handleBirthdaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await http.post(`/users/${user?.id}/onboarding/birthday`, { birthday });
      setStep(3);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error saving birthday');
    }
  };

  const handleGenresSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (genres.length === 0) {
      setError('Please select at least one genre');
      return;
    }
    try {
      await http.post(`/users/${user?.id}/onboarding/genres`, { preferredGenres: genres.join(',') });
      await http.post(`/users/${user?.id}/onboarding/complete`);
      await checkAuth(); // Refresh user state
      navigate('/explore');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error saving genres');
    }
  };

  const toggleGenre = (genre: string) => {
    if (genres.includes(genre)) {
      setGenres(genres.filter(g => g !== genre));
    } else if (genres.length < 5) {
      setGenres([...genres, genre]);
    }
  };

  if (isLoading) return <div className="text-center p-12">Loading setup...</div>;
  if (!user) return <div className="text-center p-12">Please log in to complete setup.</div>;

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white dark:bg-slate-800 rounded shadow">
      <h2 className="text-2xl font-bold mb-2 text-center text-primary">Welcome, {user.username}!</h2>
      <p className="text-center mb-6 text-gray-500">Let's set up your profile.</p>
      
      {error && <div className="mb-4 text-accent text-center">{error}</div>}

      {step === 1 && (
        <form onSubmit={handleGenderSubmit}>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3">What is your gender?</label>
            <div className="space-y-2">
              {['Male', 'Female', 'Non-binary', 'Prefer not to say'].map((g) => (
                <label key={g} className="flex items-center space-x-2 p-2 border rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700">
                  <input type="radio" name="gender" value={g} checked={gender === g} onChange={() => setGender(g)} required />
                  <span>{g}</span>
                </label>
              ))}
            </div>
          </div>
          <button type="submit" className="w-full bg-primary text-white p-2 rounded hover:bg-green-600 transition" disabled={!gender}>Next</button>
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
              required
            />
          </div>
          <button type="submit" className="w-full bg-primary text-white p-2 rounded hover:bg-green-600 transition" disabled={!birthday}>Next</button>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={handleGenresSubmit}>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Select your favorite genres (up to 5)</label>
            <div className="flex flex-wrap gap-2">
              {availableGenres.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGenre(g)}
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
          <button type="submit" className="w-full bg-primary text-white p-2 rounded hover:bg-green-600 transition" disabled={genres.length === 0}>Complete Setup</button>
        </form>
      )}
    </div>
  );
}
