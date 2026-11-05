import { BACKGROUND_PRESETS, type Background, type PresetKey } from '../../../shared/board';

// Theme hue is shared by the native capsule and its settings preview. Brightness
// follows the existing light/dark preference; no additional preference is stored.
const ACCENTS: Record<PresetKey, string> = {
  classic: '#b29b7d', meadow: '#71a965', ocean: '#5f9fba', sunset: '#d99290',
  night: '#8589c2', friday: '#dca688', monday: '#929dab', boba: '#b49676',
  pie: '#d4aa62', candy: '#bf92bb', paper: '#9aa6ae',
  'cloud-rest': '#85afc5', 'deep-rest': '#548eaa', 'galaxy-off': '#a08cc6',
};
const mix = (base: string, tint: string, amount: number) => '#' + [1, 3, 5].map(index => {
  const a = parseInt(base.slice(index, index + 2), 16);
  const b = parseInt(tint.slice(index, index + 2), 16);
  return Math.round(a + (b - a) * amount).toString(16).padStart(2, '0');
}).join('');

export function capsuleTheme(background: Background, mode: 'light' | 'dark') {
  const accent = background.kind === 'preset' ? ACCENTS[background.value]
    : background.kind === 'color' ? background.value : '#92a69c';
  const dark = mode === 'dark';
  const surface = mix(dark ? '#202b27' : '#fffefa', accent, dark ? 0.15 : 0.10);
  return {
    name: background.kind === 'preset' ? BACKGROUND_PRESETS[background.value]
      : background.kind === 'color' ? '自选颜色' : '图片背景',
    accent, surface,
    ink: mix(dark ? '#edf4ef' : '#223129', accent, dark ? 0.24 : 0.25),
    muted: mix(dark ? '#bdcdc3' : '#435248', accent, dark ? 0.14 : 0.10),
    border: mix(surface, accent, dark ? 0.48 : 0.28),
    hover: mix(surface, accent, dark ? 0.28 : 0.20),
    borderHover: mix(surface, accent, dark ? 0.70 : 0.52),
    highlight: dark ? '#ffffff0b' : '#ffffffb8',
  };
}
