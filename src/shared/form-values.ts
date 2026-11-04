import { validDate } from '../domain/tasks/model.js';

/** Picker values keep the existing local date/time contracts; never convert through UTC. */
export function normalizeTime(value: string, seconds = false): string | null {
  const text = value.trim();
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(text)) return null;
  if (!seconds && text.length !== 5) return null;
  return seconds && text.length === 5 ? `${text}:00` : text;
}

export function validPickerDate(value: string, min?: string, max?: string): boolean {
  return validDate(value) && (!min || value >= min) && (!max || value <= max);
}
