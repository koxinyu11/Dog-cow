import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTime, validPickerDate } from '../../dist-electron/src/shared/form-values.js';

test('every minute is selectable and preserves the existing HH:mm contract', () => {
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute++) {
      const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      assert.equal(normalizeTime(time), time);
      assert.equal(normalizeTime(time, true), `${time}:00`);
    }
  }
});

test('second precision survives confirmation without rounding and rejects invalid/partial times', () => {
  for (const time of ['00:00:00', '09:30:17', '12:00:59', '23:59:59']) {
    assert.equal(normalizeTime(time, true), time);
    assert.equal(normalizeTime(time), null);
  }
  assert.equal(normalizeTime(' 09:30 '), '09:30');
  for (const time of ['', '9:30', '09:', '24:00', '-1:00', '12:60', '09:30:60', '09:30:00.5', '09:30Z']) {
    assert.equal(normalizeTime(time), null);
    assert.equal(normalizeTime(time, true), null);
  }
});

test('calendar dates respect leap years and inclusive tracking/today bounds without UTC conversion', () => {
  for (const date of ['2024-02-29', '2026-01-01', '2026-12-31']) assert.equal(validPickerDate(date), true);
  for (const date of ['', '2026-02-29', '2026-04-31', '2026-00-01', '2026-13-01', '2026-11-00', '26-11-04', '2026-11-04T00:00:00Z']) assert.equal(validPickerDate(date), false);
  assert.equal(validPickerDate('2026-11-01', '2026-11-01', '2026-11-04'), true);
  assert.equal(validPickerDate('2026-11-04', '2026-11-01', '2026-11-04'), true);
  assert.equal(validPickerDate('2026-10-31', '2026-11-01', '2026-11-04'), false);
  assert.equal(validPickerDate('2026-11-05', '2026-11-01', '2026-11-04'), false);
});
