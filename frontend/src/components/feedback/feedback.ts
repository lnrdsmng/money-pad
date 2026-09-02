import { createContext, useContext } from 'react';

export type FeedbackTone = 'success' | 'error' | 'warning' | 'info';

export interface FeedbackOptions {
  duration?: number;
}

export interface FeedbackApi {
  showFeedback: (message: string, tone?: FeedbackTone, options?: FeedbackOptions) => void;
  success: (message: string, options?: FeedbackOptions) => void;
  error: (message: string, options?: FeedbackOptions) => void;
  warning: (message: string, options?: FeedbackOptions) => void;
  info: (message: string, options?: FeedbackOptions) => void;
}

export const FeedbackContext = createContext<FeedbackApi | null>(null);

export function useFeedback(): FeedbackApi {
  const context = useContext(FeedbackContext);

  if (!context) {
    throw new Error('useFeedback must be used within a ToastProvider');
  }

  return context;
}
