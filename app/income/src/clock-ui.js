import { applyAttendanceAction, getAttendanceDay, setAttendanceTimes } from './attendance.js';

const dateKey = (date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
const timeValue = (at) => at === null ? '' : new Date(at).toTimeString().slice(0, 8);
const timeLabel = (at) => at === null ? '未登记' : new Date(at).toLocaleTimeString('zh-CN', { hour12: false });

// The editor owns only an uncommitted dialog draft. The app owns and persists facts.
export function mountClockUI(container, { getState, onCommit }) {
  container.innerHTML = `
    <div class="section-heading"><h2>打卡和补录</h2><span id="clock-status" class="status"></span></div>
    <p id="clock-guidance" class="help"></p>
    <div class="clock-actions">
      <button id="clock-start" type="button">上班打卡</button>
      <button id="clock-pause" type="button" class="secondary">午休</button>
      <button id="clock-resume" type="button" class="secondary">继续上班</button>
      <button id="clock-finish" type="button">下班打卡</button>
      <button id="clock-history" type="button" class="secondary">补录其他日期</button>
    </div>
    <p id="attendance-feedback" class="help" role="status"></p>
    <p id="attendance-times" class="help"></p>
    <p id="unfinished-notice" class="notice" hidden></p>
    <details><summary>已登记的实际时间</summary><ul id="clock-records" class="leave-list"></ul></details>
    <dialog id="clock-dialog" aria-labelledby="clock-dialog-title">
      <form id="clock-form" novalidate>
        <h2 id="clock-dialog-title">登记实际上下班时间</h2>
        <p class="help">是不是忘记点了？确认后才会保存，取消不产生打卡。</p>
        <div class="fields">
          <div class="field"><label for="clock-date">打卡日期</label><input id="clock-date" type="date" required /></div>
          <div class="field"><label for="clock-method">打卡方式</label><select id="clock-method"><option value="recorded">现在打卡</option><option value="backfill">忘记打卡，补实际时间</option></select></div>
          <div class="field"><label for="clock-in-time">实际上班时间</label><input id="clock-in-time" type="time" step="1" /></div>
          <div class="field"><label for="clock-out-time">实际下班时间</label><input id="clock-out-time" type="time" step="1" /></div>
        </div>
        <p id="clock-dialog-help" class="help"></p>
        <p id="clock-error" class="field-error" role="alert" hidden></p>
        <div class="form-actions"><button type="submit">确认并保存</button><button id="clock-cancel" class="secondary" type="button">取消</button></div>
      </form>
    </dialog>`;
  const element = (id) => container.querySelector(`#${id}`);
  const dialog = element('clock-dialog');
  const form = element('clock-form');
  const date = element('clock-date');
  const method = element('clock-method');
  const start = element('clock-in-time');
  const end = element('clock-out-time');
  let draft = null;
  let message = '';
  let recordsSignature = '';

  function showError(value = '') {
    element('clock-error').textContent = value;
    element('clock-error').hidden = !value;
  }

  function syncDialog() {
    const { attendance, settings } = getState();
    const day = attendance.days.find((entry) => entry.date === date.value);
    const recorded = method.value === 'recorded';
    date.disabled = recorded || draft.lockDate;
    start.disabled = recorded && (draft.action === 'start' || Boolean(day?.clockIn));
    end.disabled = recorded;
    start.parentElement.hidden = false;
    end.parentElement.hidden = draft.action === 'start' && !day?.clockOut;
    if (recorded) {
      if (draft.action === 'start') start.value = timeValue(draft.at);
      if (draft.action === 'finish') end.value = timeValue(draft.at);
    }
    const missingStart = draft.action === 'finish' && !day?.clockIn;
    element('clock-dialog-help').textContent = missingStart
      ? '缺少上班记录，请同时补填实际上班时间。下班时间只统计到现在，不提前计算未来早退。'
      : `补录可填写 ${attendance.trackingFrom} 起的实际时间。标准排班 ${settings.startTime}–${settings.endTime}，仅用于对照。`;
    showError();
  }

  function openEditor(action, selectedDate) {
    const { settings, attendance } = getState();
    if (!settings) return;
    const now = new Date();
    const selected = selectedDate ?? dateKey(now);
    const day = attendance.days.find((entry) => entry.date === selected);
    const existing = action === 'edit' || (action === 'start' ? day?.clockIn : day?.clockOut);
    draft = { action, at: now.getTime(), lockDate: action !== 'edit' || Boolean(selectedDate), original: day };
    date.value = selected;
    date.min = attendance.trackingFrom;
    date.max = dateKey(now);
    method.value = existing || action === 'edit' ? 'backfill' : 'recorded';
    method.querySelector('option[value="recorded"]').disabled = action === 'edit';
    start.value = timeValue(day?.clockIn?.at ?? null);
    end.value = timeValue(day?.clockOut?.at ?? null);
    element('clock-dialog-title').textContent = action === 'start' ? '上班打卡' : action === 'finish' ? '下班打卡' : '补录或修改实际时间';
    syncDialog();
    dialog.showModal();
  }

  method.addEventListener('change', syncDialog);
  date.addEventListener('change', () => {
    const { attendance } = getState();
    draft.original = attendance.days.find((entry) => entry.date === date.value);
    start.value = timeValue(draft.original?.clockIn?.at ?? null);
    end.value = timeValue(draft.original?.clockOut?.at ?? null);
    syncDialog();
  });
  element('clock-cancel').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { draft = null; });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!draft) return;
    const { attendance } = getState();
    const original = attendance.days.find((entry) => entry.date === date.value);
    const parse = (input, previous) => {
      if (!input.value) return null;
      if (previous && timeValue(previous.at) === input.value && date.value === dateKey(new Date(previous.at))) return previous.at;
      return new Date(`${date.value}T${input.value}`).getTime();
    };
    let startAt = parse(start, original?.clockIn);
    let endAt = parse(end, original?.clockOut);
    if (draft.action === 'start' && !start.value) return showError('请填写实际上班时间。');
    if (draft.action === 'finish' && (!start.value || !end.value)) return showError('请同时填写实际上班和下班时间。');
    if (draft.action === 'start') endAt = original?.clockOut?.at ?? null;
    if (method.value === 'recorded') {
      if (draft.action === 'start') startAt = draft.at;
      if (draft.action === 'finish') endAt = draft.at;
    }
    const startSource = method.value === 'recorded' && draft.action === 'start' ? 'recorded' : 'backfill';
    const endSource = method.value === 'recorded' && draft.action === 'finish' ? 'recorded' : 'backfill';
    const result = setAttendanceTimes(attendance, {
      date: date.value, startAt, endAt, source: method.value, startSource, endSource,
    }, new Date());
    if (!result.ok) return showError(result.message);
    if (!onCommit(result.attendance)) return showError('记录未通过保存校验，原数据已保留，请重试。');
    message = '实际时间已应用，今日与本月金额已重新计算。';
    dialog.close();
    render();
  });
  element('clock-start').addEventListener('click', () => openEditor('start'));
  element('clock-finish').addEventListener('click', () => openEditor('finish'));
  element('clock-history').addEventListener('click', () => openEditor('edit'));
  element('clock-records').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-date]');
    if (button) openEditor('edit', button.dataset.date);
  });
  for (const action of ['pause', 'resume']) element(`clock-${action}`).addEventListener('click', () => {
    const result = applyAttendanceAction(getState().attendance, action, new Date());
    if (!result.ok) message = result.message;
    else if (!onCommit(result.attendance)) message = '午休记录未通过校验，原数据保持不变。';
    else message = action === 'pause' ? '已开始午休，实际工作计时暂停。' : '已结束午休，实际工作计时恢复。';
    render();
  });

  function render() {
    const { settings, attendance, snapshot, now = new Date() } = getState();
    const day = attendance.days.find((entry) => entry.date === dateKey(now));
    const clock = getAttendanceDay(attendance, dateKey(now), now);
    const enabled = Boolean(settings?.stealMode);
    const clockEnabled = enabled && settings.clockMode;
    const unavailable = !settings || !snapshot || snapshot.status === 'rest-day' || snapshot.fullDayLeave;
    element('clock-status').textContent = !enabled ? '按排班计费' : clock.state === 'paused' ? '午休中' : clock.state === 'finished' ? '已登记下班' : clockEnabled && !day?.clockIn ? '待上班打卡' : '工作中';
    element('clock-guidance').textContent = !enabled ? '工资自动按规定上下班时间累计。开启偷时间模式后可记录午休。'
      : clockEnabled ? '上下班打卡可选择现在记录或补实际时间；漏上班卡的暂估会在补录后重算。'
        : '只记录午休，按标准上下班边界统计。开启上下班模式后可补卡并统计上班晚、下班早。';
    for (const id of ['clock-start', 'clock-finish', 'clock-history']) element(id).hidden = !clockEnabled;
    element('clock-start').textContent = day?.clockIn ? '修改上班时间' : '上班打卡';
    element('clock-finish').textContent = day?.clockOut ? '修改下班时间' : '下班打卡';
    element('clock-start').disabled = !day?.clockIn && unavailable;
    element('clock-finish').disabled = !settings;
    element('clock-history').disabled = !settings;
    element('clock-pause').hidden = !enabled || clock.state === 'paused';
    element('clock-pause').disabled = unavailable || clock.state === 'finished' || (clockEnabled && !day?.clockIn);
    element('clock-resume').hidden = !enabled || clock.state !== 'paused';
    element('clock-resume').disabled = !settings;
    element('attendance-feedback').textContent = message;
    element('attendance-times').textContent = day ? `实际上班 ${timeLabel(day.clockIn?.at ?? null)} · 下班 ${timeLabel(day.clockOut?.at ?? null)}` : '';
    const warnings = [];
    if (snapshot?.pendingClockIn) warnings.push('还没有上班卡，上班晚金额暂按规定上班时刻至现在估算；忘记打卡可补实际时间。');
    if (snapshot?.pendingDates?.length) warnings.push(`有 ${snapshot.pendingDates.length} 天漏上班卡待核对。`);
    if (snapshot?.unfinishedDates?.length) warnings.push(`有 ${snapshot.unfinishedDates.length} 天未登记下班；不会猜测早退，实际计时最多到当天结束。`);
    if (clock.needsReview && !warnings.length) warnings.push('设备时间早于已保存操作，请核对设备时间；原记录保持不变。');
    element('unfinished-notice').textContent = warnings.join(' ');
    element('unfinished-notice').hidden = !warnings.length;
    const signature = JSON.stringify([attendance.days, clockEnabled]);
    if (signature !== recordsSignature) {
      recordsSignature = signature;
      const list = element('clock-records');
      list.replaceChildren();
      for (const record of [...attendance.days].reverse()) {
        const row = document.createElement('li');
        const description = document.createElement('span');
        const source = (fact) => fact ? `${timeLabel(fact.at)}（${fact.source === 'backfill' ? '补录' : '实记'}，首次操作 ${new Date(fact.recordedAt).toLocaleString('zh-CN', { hour12: false })}）` : '未登记';
        description.textContent = `${record.date} · 上班 ${source(record.clockIn)} · 下班 ${source(record.clockOut)} · 午休 ${record.breaks.length} 段`;
        row.append(description);
        if (clockEnabled) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'secondary';
          button.dataset.date = record.date;
          button.textContent = '补录 / 修改';
          button.setAttribute('aria-label', `补录或修改 ${record.date} 实际时间`);
          row.append(button);
        }
        list.append(row);
      }
      if (!attendance.days.length) list.textContent = '还没有实际打卡或午休记录。';
    }
  }
  return { render };
}
