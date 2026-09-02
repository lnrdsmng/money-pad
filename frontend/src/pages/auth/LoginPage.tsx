import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { LoaderCircle } from 'lucide-react';
import { getApiErrorMessage } from '../../utils/apiError';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const loggedUser = await login({ username, password });
      if (loggedUser?.role === 'admin') {
        navigate('/admin');
      } else {
        navigate(loggedUser?.onboardingCompleted ? '/explore' : '/onboarding');
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to sign in. Check your credentials and try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-6 sm:mt-10 p-4 sm:p-6 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700">
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-center text-primary">Login to MoneyPad</h2>
      {error && <div role="alert" className="mb-4 text-accent text-center">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Username</label>
          <input
            type="text"
            placeholder="Username"
            className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            placeholder="Password"
            className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded bg-primary p-2 text-white transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Signing in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
