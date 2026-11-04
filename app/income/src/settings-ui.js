import { DEFAULT_SETTINGS } from './calculator.js';
import { getMonthPlan } from './calendar.js';
import { validatePayrollConfig } from './payroll.js';
import { mountPayrollEditor } from './payroll-ui.js';
import { mountClockUI } from './clock-ui.js';

// This view owns drafts only. The shared controller owns all applied state and ticks.
export function mountIncomeSettings(root, controller) {
  const document = root.ownerDocument;
  const settingsForm = root.querySelector('#settings-form');
  const leaveForm = root.querySelector('#leave-form');
  const fields = {
    monthlySalary: settingsForm.elements.monthlySalary,
    salaryMode: settingsForm.elements.salaryMode,
    stealMode: settingsForm.elements.stealMode,
    clockMode: settingsForm.elements.clockMode,
    calendarMode: settingsForm.elements.calendarMode,
    startTime: settingsForm.elements.startTime,
    endTime: settingsForm.elements.endTime,
    workdays: root.querySelector('#workdays-group'),
    lunchCountsAsWork: settingsForm.elements.lunchCountsAsWork,
    lunchStartTime: settingsForm.elements.lunchStartTime,
    lunchEndTime: settingsForm.elements.lunchEndTime,
  };
  const weekdayInputs = [...settingsForm.querySelectorAll('input[name="workdays"]')];
  const leaveFields = {
    date: root.querySelector('#leave-date'), paid: root.querySelector('#leave-paid'),
    startTime: root.querySelector('#leave-start'), endTime: root.querySelector('#leave-end'),
    fullDay: root.querySelector('#leave-full-day'),
  };
  const ui = Object.fromEntries([
    'migration-notice', 'storage-feedback', 'save-settings', 'calculation-feedback',
    'form-feedback', 'draft-workdays', 'calendar-feedback', 'refresh-calendar',
    'leave-controls', 'save-leave', 'cancel-leave-edit', 'leave-feedback', 'leave-list',
  ].map((id) => [id, root.getElementById(id)]));
  const dateTime = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  let state = controller.getState();
  let editingLeaveId = null;
  let settingsSaveTimer = null;
  let leaveSaveTimer = null;
  let leaveSignature = '';
  const leaveRows = new Map();
  const payrollEditor = mountPayrollEditor(root.querySelector('#payroll-panel'));
  const clockEditor = mountClockUI(root.querySelector('#clock-panel'), {
    getState: () => controller.getState(),
    onCommit: (attendance) => controller.commitAttendance(attendance).applied,
  });

  function setText(element, value) {
    if (element.textContent !== value) element.textContent = value;
  }

  function setNotice(element, value = '') {
    setText(element, value);
    element.hidden = !value;
  }

  function localDateKey(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }

  function updateInputModes() {
    fields.clockMode.disabled = !fields.stealMode.checked;
    if (!fields.stealMode.checked) fields.clockMode.checked = false;
    root.querySelector('#payroll-panel').hidden = fields.salaryMode.value !== 'gross';
    fields.lunchStartTime.disabled = fields.lunchCountsAsWork.checked;
    fields.lunchEndTime.disabled = fields.lunchCountsAsWork.checked;
  }

  function fillInitialSettings(settings) {
    for (const key of ['monthlySalary', 'salaryMode', 'startTime', 'endTime', 'calendarMode', 'lunchStartTime', 'lunchEndTime']) {
      fields[key].value = settings[key];
    }
    for (const key of ['stealMode', 'clockMode', 'lunchCountsAsWork']) fields[key].checked = settings[key];
    for (const input of weekdayInputs) input.checked = settings.workdays.includes(Number(input.value));
    payrollEditor.fill(settings.payroll);
    updateInputModes();
  }

  function readDraft() {
    return {
      monthlySalary: fields.monthlySalary.value,
      salaryMode: fields.salaryMode.value,
      stealMode: fields.stealMode.checked,
      clockMode: fields.clockMode.checked,
      calendarMode: fields.calendarMode.value,
      startTime: fields.startTime.value,
      endTime: fields.endTime.value,
      workdays: weekdayInputs.filter((input) => input.checked).map((input) => Number(input.value)),
      lunchCountsAsWork: fields.lunchCountsAsWork.checked,
      lunchStartTime: fields.lunchStartTime.value,
      lunchEndTime: fields.lunchEndTime.value,
      // A hidden invalid payroll draft must not prevent direct net-salary input.
      payroll: fields.salaryMode.value === 'gross' ? payrollEditor.read()
        : (controller.getState().settings?.payroll ?? DEFAULT_SETTINGS.payroll),
    };
  }

  function showFieldErrors(fieldMap, messages = {}, prefix = '') {
    for (const [key, input] of Object.entries(fieldMap)) {
      const error = root.getElementById(`${prefix}${key}-error`);
      const message = messages[key] ?? '';
      if (error) setNotice(error, message);
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
    if (prefix) setNotice(root.getElementById('leave-general-error'), messages.general ?? messages.fullDay ?? messages.id ?? '');
  }

  function focusFirstError(fieldMap, messages = {}) {
    const key = Object.keys(messages).find((name) => fieldMap[name]);
    if (key) fieldMap[key].focus();
    else if (messages.general) root.getElementById('leave-general-error').focus();
  }

  function renderCalendarInfo() {
    const now = state.now ?? new Date();
    const year = now.getFullYear();
    const calendar = state.calendar;
    const context = state.calendarContext;
    ui['refresh-calendar'].disabled = calendar.busy;
    if (fields.calendarMode.value === 'weekly') {
      setText(ui['calendar-feedback'], '仅按每周排班计算，不包含国家节假日和补班安排。');
    } else if (calendar.busy && !context.readyYears.includes(year)) {
      setText(ui['calendar-feedback'], '正在加载并校验年度调休日历…');
    } else if (context.readyYears.includes(year)) {
      const result = calendar.results[year];
      const source = { network: '联网数据', cache: '已验证缓存', snapshot: '内置年度快照' }[result?.source] ?? '已验证数据';
      const updated = Number.isFinite(result?.updatedAt) ? `，数据检查/版本时间 ${dateTime.format(new Date(result.updatedAt))}` : '';
      const warning = result?.refreshFailed ? '联网更新未成功，正在使用可用数据。' : '';
      setText(ui['calendar-feedback'], `${year} 年调休日历可用：${source}${updated}。${warning}`);
    } else {
      setText(ui['calendar-feedback'], `${year} 年调休数据未发布或暂时不可用。可刷新重试，或明确选择仅按周排班。`);
    }
    const workdays = weekdayInputs.filter((input) => input.checked).map((input) => Number(input.value));
    if (!workdays.length) {
      setText(ui['draft-workdays'], '请至少选择一个每周工作日。');
      return;
    }
    try {
      const plan = getMonthPlan({ calendarMode: fields.calendarMode.value, workdays }, year, now.getMonth(), context);
      setText(ui['draft-workdays'], `按当前表单排班：${year} 年 ${now.getMonth() + 1} 月，计划 ${plan.workdayCount} 个工作日（请假前）。`);
    } catch {
      setText(ui['draft-workdays'], '本月计划工作日：等待有效调休日历。');
    }
  }

  function autoSaveSettings() {
    clearTimeout(settingsSaveTimer);
    settingsSaveTimer = null;
    updateInputModes();
    const draft = readDraft();
    const result = controller.updateSettings(draft);
    showFieldErrors(fields, result.errors);
    const payrollErrors = draft.salaryMode === 'gross' ? validatePayrollConfig(draft.payroll).errors : {};
    payrollEditor.showErrors(payrollErrors);
    setNotice(root.getElementById('payroll-error'), result.errors?.payroll ?? '');
    setText(ui['form-feedback'], result.message || (result.applied
      ? (result.persisted ? '已自动保存，首页金额已重算。' : '修改已应用，本次尚未保存，请重试。')
      : '输入尚未完成或无效，仍使用上次有效设置；请修正标出的字段。'));
    renderCalendarInfo();
  }

  settingsForm.addEventListener('submit', (event) => { event.preventDefault(); autoSaveSettings(); });
  settingsForm.addEventListener('input', () => {
    updateInputModes();
    clearTimeout(settingsSaveTimer);
    setText(ui['form-feedback'], '正在自动保存…');
    renderCalendarInfo();
    settingsSaveTimer = setTimeout(autoSaveSettings, 250);
  });
  settingsForm.addEventListener('change', autoSaveSettings);
  settingsForm.addEventListener('focusout', () => { if (settingsSaveTimer !== null) autoSaveSettings(); });
  ui['save-settings'].addEventListener('click', () => {
    const result = controller.retrySave();
    setText(ui['form-feedback'], result.message || (result.persisted ? '已重新保存当前有效数据。' : '本次仍未保存，请保留当前页面。'));
  });
  ui['refresh-calendar'].addEventListener('click', () => { void controller.refreshCalendar(true); });

  function updateLeaveTimeInputs() {
    leaveFields.startTime.disabled = leaveFields.fullDay.checked;
    leaveFields.endTime.disabled = leaveFields.fullDay.checked;
  }

  function resetLeaveEditor() {
    clearTimeout(leaveSaveTimer);
    leaveSaveTimer = null;
    editingLeaveId = null;
    leaveForm.reset();
    const current = controller.getState();
    leaveFields.date.value = localDateKey(current.now ?? new Date());
    leaveFields.startTime.value = current.settings?.startTime ?? DEFAULT_SETTINGS.startTime;
    leaveFields.endTime.value = current.settings?.endTime ?? DEFAULT_SETTINGS.endTime;
    leaveFields.paid.value = 'true';
    leaveFields.fullDay.checked = true;
    updateLeaveTimeInputs();
    showFieldErrors(leaveFields, {}, 'leave-');
    setText(ui['save-leave'], '添加请假');
    ui['cancel-leave-edit'].hidden = true;
  }

  function renderLeaveList() {
    const signature = JSON.stringify(state.leaves);
    if (signature === leaveSignature) return;
    leaveSignature = signature;
    const records = [...state.leaves].sort((left, right) => left.date.localeCompare(right.date) || left.startTime.localeCompare(right.startTime));
    const ids = new Set(records.map((leave) => leave.id));
    for (const [id, row] of leaveRows) {
      if (!ids.has(id)) { row.item.remove(); leaveRows.delete(id); }
    }
    for (const [index, leave] of records.entries()) {
      let row = leaveRows.get(leave.id);
      if (!row) {
        const item = document.createElement('li');
        const description = document.createElement('span');
        const actions = document.createElement('div');
        actions.className = 'leave-actions';
        const buttons = [];
        for (const [action, label] of [['edit', '修改'], ['delete', '删除']]) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'secondary';
          button.dataset.action = action;
          button.dataset.id = leave.id;
          button.textContent = label;
          actions.append(button);
          buttons.push(button);
        }
        item.append(description, actions);
        row = { item, description, buttons };
        leaveRows.set(leave.id, row);
      }
      row.description.textContent = `${leave.date} · ${leave.fullDay ? '整天' : `${leave.startTime}–${leave.endTime}`} · ${leave.paid ? '带薪请假' : '扣薪请假'}`;
      for (const button of row.buttons) {
        button.setAttribute('aria-label', `${button.textContent} ${leave.date} ${leave.paid ? '带薪' : '扣薪'}请假 ${leave.fullDay ? '整天' : `${leave.startTime}至${leave.endTime}`}`);
      }
      if (ui['leave-list'].children[index] !== row.item) ui['leave-list'].insertBefore(row.item, ui['leave-list'].children[index] ?? null);
    }
  }

  function persistLeaveEditor(finish = false) {
    clearTimeout(leaveSaveTimer);
    leaveSaveTimer = null;
    if (!controller.getState().settings) return;
    const wasEditing = Boolean(editingLeaveId);
    const randomId = () => document.defaultView.crypto?.randomUUID?.() ?? `leave-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = controller.saveLeave({
      id: editingLeaveId ?? randomId(),
      date: leaveFields.date.value,
      fullDay: leaveFields.fullDay.checked,
      startTime: leaveFields.startTime.value,
      endTime: leaveFields.endTime.value,
      paid: leaveFields.paid.value === 'true',
    }, editingLeaveId);
    showFieldErrors(leaveFields, result.errors, 'leave-');
    if (!result.applied) {
      setText(ui['leave-feedback'], result.message || '输入尚未完成或请假时段冲突，仍保留原有效记录。');
      if (finish) focusFirstError(leaveFields, result.errors);
      return;
    }
    if (finish) resetLeaveEditor();
    setText(ui['leave-feedback'], `${wasEditing ? '修改已自动应用' : '请假已添加'}${result.persisted ? '并保存' : '，本次尚未保存'}；首页金额已重算，打卡原始时间不变。`);
  }

  leaveFields.fullDay.addEventListener('change', updateLeaveTimeInputs);
  leaveForm.addEventListener('submit', (event) => { event.preventDefault(); persistLeaveEditor(true); });
  leaveForm.addEventListener('input', () => {
    if (!editingLeaveId) return;
    clearTimeout(leaveSaveTimer);
    setText(ui['leave-feedback'], '正在自动保存请假修改…');
    leaveSaveTimer = setTimeout(() => persistLeaveEditor(), 250);
  });
  leaveForm.addEventListener('change', () => { if (editingLeaveId) persistLeaveEditor(); });
  leaveForm.addEventListener('focusout', () => { if (editingLeaveId && leaveSaveTimer !== null) persistLeaveEditor(); });
  ui['cancel-leave-edit'].addEventListener('click', () => {
    resetLeaveEditor();
    setText(ui['leave-feedback'], '已结束编辑，已自动保存的修改保持生效。');
  });
  ui['leave-list'].addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const leave = controller.getState().leaves.find((record) => record.id === button.dataset.id);
    if (!leave) return;
    if (button.dataset.action === 'delete') {
      const result = controller.removeLeave(leave.id);
      if (result.applied && editingLeaveId === leave.id) resetLeaveEditor();
      setText(ui['leave-feedback'], result.message || (result.applied
        ? `已删除请假记录${result.persisted ? '并保存' : '，本次尚未保存'}，首页金额已重算。`
        : '未删除记录，请检查保存状态后重试。'));
      return;
    }
    clearTimeout(leaveSaveTimer);
    leaveSaveTimer = null;
    editingLeaveId = leave.id;
    leaveFields.date.value = leave.date;
    leaveFields.paid.value = String(leave.paid);
    leaveFields.fullDay.checked = leave.fullDay;
    const currentSettings = controller.getState().settings;
    leaveFields.startTime.value = leave.fullDay ? currentSettings.startTime : leave.startTime;
    leaveFields.endTime.value = leave.fullDay ? currentSettings.endTime : leave.endTime;
    updateLeaveTimeInputs();
    showFieldErrors(leaveFields, {}, 'leave-');
    setText(ui['save-leave'], '完成修改');
    ui['cancel-leave-edit'].hidden = false;
    setText(ui['leave-feedback'], `正在编辑 ${leave.date} 的请假，有效修改会自动保存。`);
    leaveFields.date.focus();
  });

  function render(nextState) {
    state = nextState;
    setNotice(ui['migration-notice'], state.migrationNotice ?? '');
    setNotice(ui['storage-feedback'], state.storageStatus.message ?? '');
    ui['save-settings'].hidden = !state.storageStatus.canRetry;
    setNotice(ui['calculation-feedback'], state.calculationError?.message ?? '');
    ui['leave-controls'].disabled = !state.settings;
    renderCalendarInfo();
    payrollEditor.render(state.payrollResult);
    clockEditor.render();
    renderLeaveList();
  }

  function showSection(name) {
    for (const section of root.querySelectorAll('[data-settings-section]')) section.hidden = section.dataset.settingsSection !== name;
  }

  fillInitialSettings(state.settings ?? DEFAULT_SETTINGS);
  resetLeaveEditor();
  setText(ui['form-feedback'], state.settings ? '已恢复此应用保存的设置；有效修改自动保存。' : '填写后自动保存；有效修改立即生效。');
  setText(ui['leave-feedback'], state.leaves.length ? `已恢复 ${state.leaves.length} 条请假记录。` : '还没有请假记录。');
  showSection('income');
  const unsubscribe = controller.subscribe(render);
  return {
    showSection,
    dispose() {
      clearTimeout(settingsSaveTimer);
      clearTimeout(leaveSaveTimer);
      unsubscribe();
    },
  };
}
