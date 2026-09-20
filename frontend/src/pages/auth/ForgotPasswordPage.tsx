import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LoaderCircle, Mail } from 'lucide-react';
import http from '../../api/http';
import { getApiErrorMessage } from '../../utils/apiError';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    setError('');
    try {
      const response = await http.post('/auth/forgot-password', { email });
      setMessage(response.data.message);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'The reset link could not be sent. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto mt-6 max-w-md rounded-lg border border-gray-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:mt-10 sm:p-6">
      <Mail className="mx-auto mb-3 h-9 w-9 text-primary" />
      <h2 className="text-center text-xl font-bold text-primary sm:text-2xl">Reset your password</h2>
      <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
        Enter your account email and we will send you a secure reset link.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="reset-email" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
          <input id="reset-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" className="w-full rounded border border-gray-300 bg-white p-2 text-gray-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" />
        </div>
        {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{message}</p>}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
        <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded bg-primary p-2 text-white hover:bg-green-600 disabled:opacity-60">
          {isSubmitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Sending...' : 'Send reset link'}
        </button>
      </form>
      <Link to="/login" className="mt-4 block text-center text-sm font-medium text-primary hover:underline">Back to login</Link>
    </div>
  );
}
