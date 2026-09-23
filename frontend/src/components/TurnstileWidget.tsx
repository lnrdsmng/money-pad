import { useEffect, useRef, useState } from 'react';
import { turnstileEnabled } from '../utils/turnstile';

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window { turnstile?: TurnstileApi }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = () => window.turnstile ? resolve(window.turnstile) : reject(new Error('Verification did not load.'));
      script.onerror = () => reject(new Error('Verification did not load.'));
      document.head.appendChild(script);
    }).catch((error) => {
      scriptPromise = null;
      throw error;
    });
  }
  return scriptPromise!;
}

export function TurnstileWidget({ action, onToken, resetKey }: {
  action: string;
  onToken: (token: string) => void;
  resetKey: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const callback = useRef(onToken);

  useEffect(() => {
    callback.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!turnstileEnabled || !container.current) return;
    let active = true;
    loadTurnstile().then((api) => {
      if (!active || !container.current) return;
      widgetId.current = api.render(container.current, {
        sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
        action,
        size: 'normal',
        callback: (token: string) => { setHasError(false); callback.current(token); },
        'expired-callback': () => {
          callback.current('');
          if (widgetId.current) api.reset(widgetId.current);
        },
        'error-callback': () => { callback.current(''); setHasError(true); },
      });
    }).catch(() => callback.current(''));
    return () => {
      active = false;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [action]);

  useEffect(() => {
    if (resetKey === 0 || !widgetId.current || !window.turnstile) return;
    callback.current('');
    setHasError(false);
    window.turnstile.reset(widgetId.current);
  }, [resetKey]);

  if (!turnstileEnabled) return null;
  return <div className="flex w-full min-w-0 flex-col items-center">
    <div ref={container} aria-label="Security verification" />
    {hasError && <button type="button" onClick={() => widgetId.current && window.turnstile?.reset(widgetId.current)}
      className="mt-2 text-sm text-primary underline">Retry verification</button>}
  </div>;
}
