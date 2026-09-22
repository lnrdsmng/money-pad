import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import http from '../../api/http';
import { PasswordStrengthIndicator } from '../../components/PasswordStrengthIndicator';
import { PasswordInput } from '../../components/common/PasswordInput';
import { getApiErrorMessage } from '../../utils/apiError';
import { isValidPassword } from '../../utils/password';
import { useFeedback } from '../../components/feedback/feedback';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const feedback = useFeedback();
  const token = searchParams.get('token') ?? '';
  const email = searchParams.get('email') ?? '';
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const isReady = useMemo(() => token && email && isValidPassword(password) && password === passwordConfirmation, [email, password, passwordConfirmation, token]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!isReady) {
      setError('Use at least 8 characters with uppercase, lowercase, and a number, then confirm the password.');
      return;
    }
    setIsSubmitting(true);
    try {
      await http.post('/auth/reset-password', { token, email, password, password_confirmation: passwordConfirmation });
      feedback.success('Password reset successfully. You can now sign in.');
      navigate('/login', { replace: true });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'This reset link is invalid or has expired. Request a new one.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto mt-6 max-w-md rounded-lg border border-gray-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:mt-10 sm:p-6">
      <h2 className="text-center text-xl font-bold text-primary sm:text-2xl">Choose a new password</h2>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">New password</label>
          <PasswordInput value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="new-password" className="rounded border border-gray-300 p-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" />
          <PasswordStrengthIndicator password={password} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm new password</label>
          <PasswordInput value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} required autoComplete="new-password" className="rounded border border-gray-300 p-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" />
        </div>
        {(!token || !email) && <p role="alert" className="text-sm text-red-600">This reset link is incomplete. Request a new link.</p>}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
        <button type="submit" disabled={isSubmitting || !token || !email} className="flex w-full items-center justify-center gap-2 rounded bg-primary p-2 text-white hover:bg-green-600 disabled:opacity-60">
          {isSubmitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Updating...' : 'Reset password'}
        </button>
      </form>
      <Link to="/forgot-password" className="mt-4 block text-center text-sm font-medium text-primary hover:underline">Request another link</Link>
    </div>
  );
}
