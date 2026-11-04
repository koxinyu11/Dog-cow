import { validateSettings } from './calculator.js';
import { validateLeaveCollection } from './leave.js';
import { createAttendance, migrateLegacyAttendance, validateAttendance } from './attendance.js';

export const SETTINGS_KEY = 'niuma-calculator.settings.v4';
export const PREVIOUS_SETTINGS_KEY = 'niuma-calculator.settings.v3';
export const V2_SETTINGS_KEY = 'niuma-calculator.settings.v2';
export const LEGACY_SETTINGS_KEY = 'niuma-calculator.settings.v1';

function legacySettings(saved) {
  if (saved?.version !== 1) return null;
  const previous = saved.settings;
  const rawDays = previous?.monthlyWorkdays;
  const monthlyWorkdays = typeof rawDays === 'number'
    ? rawDays
    : typeof rawDays === 'string' && rawDays.trim() !== '' ? Number(rawDays) : NaN;
  if (!Number.isFinite(monthlyWorkdays) || monthlyWorkdays <= 0) return null;

  const result = validateSettings({
    monthlySalary: previous?.monthlySalary,
    startTime: previous?.startTime,
    endTime: previous?.endTime,
    workdays: previous?.workdays,
    calendarMode: 'cn',
  });
  if (!result.valid || !Number.isFinite(result.settings.monthlySalary / monthlyWorkdays)) return null;
  return result.settings;
}

// Access localStorage inside the try block: browsers may deny the getter itself.
export function loadSettings(storage, now = new Date()) {
  let serialized;
  let version = 4;
  try {
    const target = storage ?? globalThis.localStorage;
    if (!target) return { status: 'unavailable' };
    for (const [key, candidateVersion] of [[SETTINGS_KEY, 4], [PREVIOUS_SETTINGS_KEY, 3], [V2_SETTINGS_KEY, 2], [LEGACY_SETTINGS_KEY, 1]]) {
      serialized = target.getItem(key);
      version = candidateVersion;
      if (serialized !== null) break;
    }
  } catch {
    console.warn('[settings:read] 无法读取浏览器本地设置。');
    return { status: 'unavailable' };
  }

  if (serialized === null) return { status: 'empty' };

  let saved;
  try {
    saved = JSON.parse(serialized);
  } catch {
    console.warn('[settings:parse] 本地设置格式无效。');
    return { status: 'invalid' };
  }

  if (version === 1) {
    const settings = legacySettings(saved);
    if (!settings) {
      console.warn('[settings:migration] 旧版本地设置无效，无法迁移。');
      return { status: 'invalid' };
    }
    // The caller saves the new key; older snapshots remain untouched as backups.
    return { status: 'migration', settings, leaves: [], attendance: createAttendance(now) };
  }

  if (saved?.version !== version) {
    console.warn('[settings:validate] 本地设置版本无效。');
    return { status: 'invalid' };
  }
  const result = validateSettings(saved.settings);
  const leaveResult = validateLeaveCollection(saved.leaves);
  const attendanceResult = version === 2
    ? { valid: true, attendance: createAttendance(now) }
    : version === 3 ? migrateLegacyAttendance(saved.attendance) : validateAttendance(saved.attendance);
  if (!result.valid || !leaveResult.valid || !attendanceResult.valid) {
    console.warn('[settings:validate] 本地设置、请假或打卡记录无效。');
    return { status: 'invalid' };
  }
  return {
    status: version < 4 ? 'migration' : 'loaded',
    settings: result.settings,
    leaves: leaveResult.records,
    attendance: attendanceResult.attendance,
  };
}

export function saveSettings(settings, leaves, attendance, storage) {
  const result = validateSettings(settings);
  const leaveResult = validateLeaveCollection(leaves);
  const attendanceResult = validateAttendance(attendance);
  if (!result.valid || !leaveResult.valid || !attendanceResult.valid) return { ok: false, reason: 'invalid' };

  try {
    const target = storage ?? globalThis.localStorage;
    if (!target) return { ok: false, reason: 'unavailable' };
    // One write keeps settings, leave and attendance records in the same snapshot.
    target.setItem(SETTINGS_KEY, JSON.stringify({
      version: 4,
      settings: result.settings,
      leaves: leaveResult.records,
      attendance: attendanceResult.attendance,
    }));
    return { ok: true };
  } catch {
    console.warn('[settings:write] 无法保存浏览器本地设置。');
    return { ok: false, reason: 'unavailable' };
  }
}
