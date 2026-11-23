import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Event } from './api.ts';
import { errorText } from './api.ts';

export function useLoad<T>(load: () => Promise<T>, key: string, keepPrevious = false) {
  const [state, set] = useState<{ key: string; value?: T; error?: string }>();
  useEffect(() => {
    let active = true;
    load().then((value) => { if (active) set({ key, value }); })
      .catch((error) => { if (active) set({ key, error: errorText(error) }); });
    return () => { active = false; };
  }, [key]);
  return state?.key === key || keepPrevious ? state : undefined;
}

export function Notice({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'error' | 'success' }) {
  return <p className={'notice ' + tone} role={tone === 'error' ? 'alert' : 'status'}>{children}</p>;
}

export function EventArtwork({ event }: { event: Event }) {
  const [failed, setFailed] = useState(false);
  const safeImage = /^https?:\/\//i.test(event.imageUrl);
  return <div className="artwork">
    {safeImage && !failed && <img src={event.imageUrl} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />}
  </div>;
}

export function Title({ title, note }: { title: string; note?: string }) {
  return <div className="page-title"><h1>{title}</h1>{note && <p>{note}</p>}</div>;
}
