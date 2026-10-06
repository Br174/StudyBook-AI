import { Capacitor } from '@capacitor/core';

export const NATIVE_API_BASE = String(
  import.meta.env?.VITE_NATIVE_API_BASE || 'https://studybook-ai.brunoverlezza.workers.dev',
).replace(/\/$/, '');

export function isNativeStudyBook() {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
}

export function apiEndpoint(path) {
  const cleanPath = String(path || '').startsWith('/') ? String(path) : `/${String(path || '')}`;
  return isNativeStudyBook() ? `${NATIVE_API_BASE}${cleanPath}` : cleanPath;
}
