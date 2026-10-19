'use client';

import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { hideToast } from '@/store/uiSlice';

export default function Toast() {
  const toast = useAppSelector((s) => s.ui.toast);
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => dispatch(hideToast()), 2800);
    return () => clearTimeout(t);
  }, [toast, dispatch]);
  return <div id="toast" role="status" aria-live="polite" className={toast ? 'show' : ''}>{toast?.text}</div>;
}
