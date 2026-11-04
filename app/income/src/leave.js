const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(`${value}T12:00:00`);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function overlaps(first, second) {
  return first.date === second.date && (
    first.fullDay || second.fullDay
    || (first.startTime < second.endTime && second.startTime < first.endTime)
  );
}

export function validateLeaveRecord(raw, existingRecords = [], excludeId = null) {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const errors = {};
  const id = typeof input.id === 'string' ? input.id.trim() : '';

  if (!id) errors.general = '请假记录缺少有效编号，请重新添加。';
  if (!isValidDate(input.date)) errors.date = '请选择有效的请假日期。';
  if (typeof input.fullDay !== 'boolean') errors.fullDay = '请选择整天或部分时段请假。';
  if (typeof input.paid !== 'boolean') errors.paid = '请选择带薪或无薪请假。';

  if (input.fullDay === false) {
    const validStart = typeof input.startTime === 'string' && TIME_PATTERN.test(input.startTime);
    const validEnd = typeof input.endTime === 'string' && TIME_PATTERN.test(input.endTime);
    if (!validStart) errors.startTime = '请选择有效的请假开始时间。';
    if (!validEnd) errors.endTime = '请选择有效的请假结束时间。';
    if (validStart && validEnd && input.endTime <= input.startTime) {
      errors.endTime = '请假结束时间必须晚于开始时间，暂仅支持同一天。';
    }
  }
  if (!Array.isArray(existingRecords)) errors.general = '已有请假记录格式不正确，请先检查保存的数据。';

  if (Object.keys(errors).length > 0) return { valid: false, leave: null, errors };

  const leave = {
    id,
    date: input.date,
    fullDay: input.fullDay,
    startTime: input.fullDay ? '' : input.startTime,
    endTime: input.fullDay ? '' : input.endTime,
    paid: input.paid,
  };
  const others = existingRecords.filter((record) => record && record.id !== excludeId);
  if (others.some((record) => record.id === id)) {
    errors.general = '请假记录编号重复，请重新添加。';
  } else if (others.some((record) => overlaps(leave, record))) {
    errors.general = '该日期的请假时段与已有记录重叠，请调整时间。';
  }

  return Object.keys(errors).length > 0
    ? { valid: false, leave: null, errors }
    : { valid: true, leave, errors };
}

export function validateLeaveCollection(records) {
  if (!Array.isArray(records)) {
    return { valid: false, records: null, errors: { general: '请假记录必须是列表。' } };
  }

  const normalized = [];
  for (const [index, record] of Array.from(records).entries()) {
    const result = validateLeaveRecord(record, normalized);
    if (!result.valid) {
      return {
        valid: false,
        records: null,
        errors: { general: `第 ${index + 1} 条请假记录无效：${Object.values(result.errors).join(' ')}` },
      };
    }
    normalized.push(result.leave);
  }
  return { valid: true, records: normalized, errors: {} };
}

// Validated records cannot overlap. Off-duty portions never reduce work or salary.
export function getLeaveIntervalsForDay(records, date, shiftStart, shiftEnd) {
  return records.filter((record) => record.date === date).map((record) => {
    const leaveStart = record.fullDay ? shiftStart : new Date(`${date}T${record.startTime}:00`).getTime();
    const leaveEnd = record.fullDay ? shiftEnd : new Date(`${date}T${record.endTime}:00`).getTime();
    return {
      start: Math.max(shiftStart, leaveStart),
      end: Math.min(shiftEnd, leaveEnd),
      paid: record.paid,
    };
  }).filter((interval) => interval.end > interval.start);
}
