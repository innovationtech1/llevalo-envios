'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { makeStore, type AppStore } from './store';
import { hydrate, SESSION_KEY } from './sessionSlice';

export default function StoreProvider({ children }: { children: ReactNode }) {
  const ref = useRef<AppStore | null>(null);
  if (!ref.current) ref.current = makeStore();

  useEffect(() => {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}'); } catch { /* datos corruptos */ }
    ref.current!.dispatch(hydrate(saved));
  }, []);

  return <Provider store={ref.current}>{children}</Provider>;
}
