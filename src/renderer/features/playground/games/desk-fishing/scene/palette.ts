/**
 * Scene colours. Foreground art keeps fixed daylight colours; each time of day adds a
 * multiply tint so every layer shifts together instead of being recoloured one by one.
 */
export type Time = 'dawn' | 'day' | 'dusk' | 'night';
export interface Palette {
  sky: [string, string, string]; sun: string; sunAt: [number, number]; glow: string;
  haze: string; far: string; mid: string; water: [string, string]; shine: string;
  tint: string; tintOpacity: number; title: string; cloud: string;
}
export const palettes: Record<Time, Palette> = {
  dawn: { sky: ['#cfd9e0', '#f1dccf', '#f8e8c9'], sun: '#fbe0b0', sunAt: [180, 128], glow: '#ffd9a8', haze: '#c7cdc9', far: '#a8b7ad', mid: '#86a08f', water: ['#b7c8c0', '#6d9a94'], shine: '#fff1d6', tint: '#ffe2d6', tintOpacity: .18, title: '#3f5a4e', cloud: '#fff4ea' },
  day: { sky: ['#bcd8db', '#dbeadb', '#f4f0d8'], sun: '#fff1c4', sunAt: [742, 74], glow: '#fff3c8', haze: '#c6d6cb', far: '#9fbaa6', mid: '#7a9c86', water: ['#9cc2b5', '#558f89'], shine: '#f7fbef', tint: '#ffffff', tintOpacity: 0, title: '#365447', cloud: '#fbfbf1' },
  dusk: { sky: ['#8f93ad', '#e4a88c', '#f6d2a0'], sun: '#ffc184', sunAt: [690, 150], glow: '#ffb27a', haze: '#cdb6ad', far: '#a29690', mid: '#7a7f74', water: ['#c6a18f', '#5f7f84'], shine: '#ffe0b8', tint: '#f3b48c', tintOpacity: .26, title: '#fff4e6', cloud: '#fbd7c0' },
  night: { sky: ['#1f2d45', '#36506a', '#5d7a83'], sun: '#f6f0d6', sunAt: [742, 74], glow: '#c9d6e8', haze: '#4b6070', far: '#3d5560', mid: '#334a4f', water: ['#3e5f6a', '#1f3b48'], shine: '#d9e4ec', tint: '#2f4a72', tintOpacity: .5, title: '#f2eedd', cloud: '#5c7084' },
};
export const timeOfDay = (hour = new Date().getHours()): Time => hour >= 5 && hour < 8 ? 'dawn' : hour >= 8 && hour < 17 ? 'day' : hour >= 17 && hour < 19 ? 'dusk' : 'night';
/** Bobber position in viewBox units (900 × 400); HTML overlays derive their percentages from it. */
export const BOBBER: [number, number] = [580, 250];
export const ROD_BASE: [number, number] = [284, 240];
export const rodTip = (phase: string): [number, number] => phase === 'reeling' ? [396, 116] : phase === 'signal' ? [426, 170] : [432, 160];
