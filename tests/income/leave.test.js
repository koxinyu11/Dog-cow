import test from 'node:test';
import assert from 'node:assert/strict';
import { getLeaveIntervalsForDay, validateLeaveCollection, validateLeaveRecord } from '../../app/income/src/leave.js';

const base = {
  id: 'leave-1',
  date: '2026-11-04',
  fullDay: false,
  startTime: '09:00',
  endTime: '13:00',
  paid: false,
};

test('normalizes whole-day records and keeps the input unchanged', () => {
  const raw = { ...base, id: ' leave-1 ', fullDay: true };
  const result = validateLeaveRecord(raw);
  assert.equal(result.valid, true);
  assert.equal(result.leave.id, 'leave-1');
  assert.equal(result.leave.startTime, '');
  assert.equal(result.leave.endTime, '');
  assert.equal(raw.startTime, '09:00');
});

test('accepts leap days and genuine partial-day records', () => {
  const result = validateLeaveRecord({ ...base, date: '2028-02-29', paid: true });
  assert.equal(result.valid, true);
  assert.equal(result.leave.paid, true);
  assert.equal(result.leave.startTime, '09:00');
});

const invalidCases = [
  ['id', ''], ['id', '   '], ['id', 1],
  ['date', '2026-02-29'], ['date', '2026-11-31'], ['date', '2026-13-01'],
  ['date', '2026-00-01'], ['date', '2026-11-00'], ['date', '2026-1-04'], ['date', '0000-01-01'],
  ['date', ''], ['date', null], ['startTime', '9:00'], ['startTime', '24:00'],
  ['startTime', '09:60'], ['startTime', ''], ['endTime', '09:00'], ['endTime', '08:00'],
  ['endTime', '24:00'], ['endTime', ''], ['paid', 'false'], ['paid', null],
  ['fullDay', 'false'], ['fullDay', null],
];
for (const [field, value] of invalidCases) {
  test('rejects invalid leave ' + field + ': ' + String(value), () => {
    const result = validateLeaveRecord({ ...base, [field]: value });
    assert.equal(result.valid, false);
    assert.equal(result.leave, null);
    assert.ok(result.errors[field === 'id' ? 'general' : field]);
  });
}

test('overlapping partial periods on the same day are rejected', () => {
  const result = validateLeaveRecord({ ...base, id: 'leave-2', startTime: '12:00', endTime: '15:00' }, [base]);
  assert.equal(result.valid, false);
  assert.match(result.errors.general, /重叠/);
});

test('adjacent partial periods and separate dates remain valid', () => {
  assert.equal(validateLeaveRecord({ ...base, id: 'leave-2', startTime: '13:00', endTime: '17:00' }, [base]).valid, true);
  assert.equal(validateLeaveRecord({ ...base, id: 'leave-2', date: '2026-11-05' }, [base]).valid, true);
});

test('a whole day conflicts with every other record on the same date', () => {
  assert.equal(validateLeaveRecord({ ...base, id: 'leave-2', fullDay: true }, [base]).valid, false);
  assert.equal(validateLeaveRecord({ ...base, id: 'leave-2' }, [{ ...base, fullDay: true }]).valid, false);
});

test('editing excludes the current ID but continues to check other records', () => {
  assert.equal(validateLeaveRecord({ ...base, paid: true }, [base], base.id).valid, true);
  const others = [base, { ...base, id: 'leave-2', startTime: '14:00', endTime: '17:00' }];
  assert.equal(validateLeaveRecord({ ...base, endTime: '15:00' }, others, base.id).valid, false);
});

test('duplicate IDs are rejected even when their dates differ', () => {
  const result = validateLeaveRecord({ ...base, date: '2026-11-05' }, [base]);
  assert.equal(result.valid, false);
  assert.match(result.errors.general, /编号重复/);
});

test('empty and valid stored collections normalize successfully', () => {
  assert.deepEqual(validateLeaveCollection([]), { valid: true, records: [], errors: {} });
  const result = validateLeaveCollection([base, { ...base, id: 'leave-2', date: '2026-11-05', fullDay: true }]);
  assert.equal(result.valid, true);
  assert.equal(result.records[1].startTime, '');
});

test('bad stored collections, duplicate IDs and overlaps are rejected as a whole', () => {
  for (const records of [null, {}, [null], Array(1), [base, { ...base, date: '2026-11-05' }],
    [base, { ...base, id: 'leave-2', startTime: '12:00' }]]) {
    const result = validateLeaveCollection(records);
    assert.equal(result.valid, false);
    assert.equal(result.records, null);
    assert.ok(result.errors.general);
  }
});

test('leave intervals are clipped to scheduled working hours', () => {
  const start = new Date(2026, 10, 4, 9).getTime();
  const end = new Date(2026, 10, 4, 17).getTime();
  const intervals = getLeaveIntervalsForDay([
    { ...base, startTime: '07:00', endTime: '11:00' },
    { ...base, id: 'leave-2', startTime: '18:00', endTime: '19:00' },
    { ...base, id: 'leave-3', date: '2026-11-05', fullDay: true },
  ], base.date, start, end);
  assert.deepEqual(intervals, [{ start, end: new Date(2026, 10, 4, 11).getTime(), paid: false }]);
});

test('whole-day leave maps to the full scheduled interval', () => {
  const start = new Date(2026, 10, 4, 9).getTime();
  const end = new Date(2026, 10, 4, 17).getTime();
  assert.deepEqual(
    getLeaveIntervalsForDay([{ ...base, fullDay: true, paid: true }], base.date, start, end),
    [{ start, end, paid: true }],
  );
});
