import { useSyncExternalStore } from 'react';

export type ThemeMode = 'light' | 'dark' | 'auto';
const KEY = 'dogcow.ui.theme';
const system = matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set<() => void>();
let mode: ThemeMode = 'auto';
try {
  const saved = localStorage.getItem(KEY);
  if (saved === 'light' || saved === 'dark') mode = saved;
} catch { /* Storage may be unavailable; follow the system for this session. */ }
export const resolvedTheme = () => mode === 'auto' ? (system.matches ? 'dark' : 'light') : mode;
function apply() {
  const resolved = resolvedTheme();
  document.documentElement.dataset.theme = resolved;
  void window.dogcow?.invoke('appearance', { mode, resolved }).catch((error: unknown) => {
    console.error('窗口外观同步失败', error);
  });
  for (const listener of listeners) listener();
}
export function setThemeMode(next: ThemeMode): boolean {
  mode = next;
  apply();
  try {
    localStorage.setItem(KEY, next);
    return true;
  } catch {
    return false;
  }
}
export function initializeTheme() {
  apply();
  system.addEventListener('change', apply);
}
export function useTheme() {
  useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, () => `${mode}:${resolvedTheme()}`);
  return { mode, resolved: resolvedTheme() };
}
