'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker on mount.
 * Placed in layout so it runs on every page.
 */
export function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('SW registration failed:', err);
      });
    }
  }, []);

  return null;
}
