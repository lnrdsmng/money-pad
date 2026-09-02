import axios from 'axios';

interface LaravelErrorResponse {
  message?: string;
  errors?: Record<string, string[] | string>;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError<LaravelErrorResponse>(error)) {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  const response = error.response;
  const message = response?.data?.message?.trim();
  if (message) return message;

  const validationErrors = response?.data?.errors;
  if (validationErrors) {
    const firstError = Object.values(validationErrors).flat()[0];
    if (typeof firstError === 'string' && firstError.trim()) return firstError;
  }

  if (!response) return 'Unable to reach the server. Check your connection and try again.';
  if (response.status === 429) return 'Too many attempts. Please wait a moment and try again.';
  if (response.status === 403) return 'You do not have permission to perform this action.';
  if (response.status === 401) return 'Your session has expired. Please sign in again.';

  return fallback;
}
