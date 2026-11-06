import { useSyncExternalStore } from 'react';
import { money } from './format';

const KEY = 'dogcow.ui.self-deception';
const listeners = new Set<() => void>();
let enabled = false;
try { enabled = localStorage.getItem(KEY) === 'on'; } catch { /* Default to real amounts. */ }

/** Presentation only: never pass this value to commands or persist it as income. */
export function displayIncome(value: unknown, multiplier: number): unknown {
  return typeof value === 'number' && Number.isFinite(value) ? value * multiplier : value;
}

export function setSelfDeception(next: boolean): boolean {
  try { localStorage.setItem(KEY, next ? 'on' : 'off'); }
  catch { return false; }
  enabled = next;
  for (const listener of listeners) listener();
  return true;
}

export function useDisplayIncome() {
  const on = useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, () => enabled);
  const multiplier = on ? 10 : 1;
  return {
    enabled: on,
    multiplier,
    money: (value: unknown) => money(displayIncome(value, multiplier)),
  };
}
