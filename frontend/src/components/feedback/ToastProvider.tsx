import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  FeedbackContext,
  type FeedbackOptions,
  type FeedbackTone,
} from './feedback';

interface Toast {
  id: number;
  message: string;
  tone: FeedbackTone;
}

const toneStyles: Record<FeedbackTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100',
  error: 'border-red-200 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950 dark:text-red-100',
  warning: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
  info: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100',
};

const toneIcons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: TriangleAlert,
  info: Info,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showFeedback = useCallback((
    message: string,
    tone: FeedbackTone = 'info',
    options?: FeedbackOptions,
  ) => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message, tone }].slice(-4));

    window.setTimeout(() => dismiss(id), options?.duration ?? (tone === 'error' ? 7000 : 4500));
  }, [dismiss]);

  const value = useMemo(() => ({
    showFeedback,
    success: (message: string, options?: FeedbackOptions) => showFeedback(message, 'success', options),
    error: (message: string, options?: FeedbackOptions) => showFeedback(message, 'error', options),
    warning: (message: string, options?: FeedbackOptions) => showFeedback(message, 'warning', options),
    info: (message: string, options?: FeedbackOptions) => showFeedback(message, 'info', options),
  }), [showFeedback]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 top-4 z-[100] flex flex-col items-end gap-3 sm:left-auto sm:w-full sm:max-w-sm"
        aria-label="Notifications"
      >
        {toasts.map((toast) => {
          const Icon = toneIcons[toast.tone];

          return (
            <div
              key={toast.id}
              role={toast.tone === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl border p-4 shadow-lg ${toneStyles[toast.tone]}`}
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <p className="min-w-0 flex-1 text-sm font-medium">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded p-0.5 opacity-70 hover:bg-black/5 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 dark:hover:bg-white/10"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </FeedbackContext.Provider>
  );
}
