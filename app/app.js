const STORAGE_KEY = 'work-todolist-generic-v1';
const LEGACY_KEYS = [];
const pad = n => String(n).padStart(2, '0');
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = value => new Date(`${value}T12:00:00`);
const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const priorityRank = { 高: 0, 中: 1, 低: 2 };
const defaultSettings = { headerKicker: 'Weekly operations desk', appTitle: '狗牛', dateLine: '', progressTitle: '今日完成度', addButtonLabel: '新增任务' };
const tagColors = {};

const templates = {};

function mondayOf(base = new Date()) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
}

function weekDates(base = new Date()) {
  const monday = mondayOf(base);
  return Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
}

const weekKey = (base = new Date()) => toISO(mondayOf(base));
const tagId = () => `tag-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const validColor = value => /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#6b7280';
const tagKey = label => String(label || '').trim().toLocaleLowerCase('zh-CN');

function mergeTagCatalog(catalog = [], tasks = []) {
  const merged = new Map();
  [...catalog, ...tasks.flatMap(task => Array.isArray(task.tags) ? task.tags : [])].forEach(tag => {
    const label = String(tag?.label || '').trim();
    if (!label) return;
    merged.set(tagKey(label), { label, color: validColor(tag.color) });
  });
  return [...merged.values()].sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
}

function normalizeTask(task) {
  const label = task.category || '工作';
  const tags = Array.isArray(task.tags)
    ? task.tags.map(tag => ({ id: tag.id || tagId(), label: tag.label || '标签', color: validColor(tag.color) }))
    : [{ id: tagId(), label, color: tagColors[label] || '#6b7280' }];
  return {
    ...task,
    note: task.note || '',
    tags,
    progress: Number.isFinite(Number(task.progress)) ? Math.max(0, Math.min(100, Math.round(Number(task.progress)))) : (task.done ? 100 : 0),
    calendarMark: Boolean(task.calendarMark),
    markerColor: validColor(task.markerColor || '#8b5cf6'),
    hasTime: Boolean(task.hasTime),
    startTime: task.startTime || '',
    endTime: task.endTime || ''
  };
}

function tasksForWeek(base) {
  const tasks = [];
  weekDates(base).forEach(date => {
    (templates[date.getDay()] || []).forEach((item, index) => tasks.push(normalizeTask({
      id: `fixed-${toISO(date)}-${index}`,
      date: toISO(date),
      title: item[0],
      category: item[1],
      priority: '中',
      note: '',
      done: false,
      fixed: true
    })));
  });
  return tasks;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.tasks)) {
      const tasks = saved.tasks.map(normalizeTask);
      return { tasks, tags: mergeTagCatalog(saved.tags, tasks), seededWeeks: saved.seededWeeks || [], settings: { ...defaultSettings, ...(saved.settings || {}) } };
    }
  } catch {}

  for (const key of LEGACY_KEYS) {
    try {
      const legacy = JSON.parse(localStorage.getItem(key));
      if (legacy && Array.isArray(legacy.tasks)) {
        return {
          tasks: legacy.tasks.map(normalizeTask),
          tags: mergeTagCatalog([], legacy.tasks),
          seededWeeks: legacy.seededWeeks || (legacy.week ? [legacy.week] : []),
          settings: { ...defaultSettings }
        };
      }
    } catch {}
  }
  return { tasks: [], tags: [], seededWeeks: [], settings: { ...defaultSettings } };
}

let state = loadState();
const save = (syncTags = true) => {
  if (syncTags) state.tags = mergeTagCatalog(state.tags, state.tasks);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

function reusableTagOptions(task = null) {
  const used = new Set((task?.tags || []).map(tag => tagKey(tag.label)));
  return state.tags.filter(tag => !used.has(tagKey(tag.label))).map(tag =>
    `<option value="${escapeHtml(tag.label)}">${escapeHtml(tag.label)}</option>`
  ).join('');
}

function findReusableTag(label) {
  return state.tags.find(tag => tagKey(tag.label) === tagKey(label));
}

function tagFromInput(label, fallbackColor) {
  const existing = findReusableTag(label);
  return { id: tagId(), label: String(label).trim(), color: existing?.color || validColor(fallbackColor) };
}

function refreshReusableTagInputs() {
  const options = reusableTagOptions();
  ['tagReuseInput', 'weeklyTagReuseInput'].forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = `<option value="">请选择已有标签</option>${options}`;
  });
}

function ensureCurrentWeek() {
  const key = weekKey(new Date());
  if (state.seededWeeks.includes(key)) return false;
  const ids = new Set(state.tasks.map(task => task.id));
  tasksForWeek(new Date()).forEach(task => { if (!ids.has(task.id)) state.tasks.push(task); });
  state.seededWeeks.push(key);
  save();
  return true;
}

function defaultSelectedDate() {
  return toISO(new Date());
}

ensureCurrentWeek();
let selected = defaultSelectedDate();
let calendarMonth = new Date(fromISO(selected).getFullYear(), fromISO(selected).getMonth(), 1);
let currentAutoWeek = weekKey(new Date());

const escapeHtml = value => String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

function launchConfetti() {
  const layer = document.getElementById('confettiLayer');
  const colors = ['#255c48', '#db6d3a', '#f4c95d', '#e76f8a', '#6c8cff', '#9b5de5'];
  layer.innerHTML = '';
  for (let i = 0; i < 90; i += 1) {
    const piece = document.createElement('span');
    piece.className = 'confetti';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.setProperty('--duration', `${2.2 + Math.random() * 1.8}s`);
    piece.style.setProperty('--drift', `${-120 + Math.random() * 240}px`);
    piece.style.setProperty('--rotation', `${Math.random() * 360}deg`);
    piece.style.animationDelay = `${Math.random() * .45}s`;
    layer.appendChild(piece);
  }
  setTimeout(() => { layer.innerHTML = ''; }, 4700);
}

function sortedTasks(tasks) {
  return tasks.map((task, index) => ({ task, index }))
    .sort((a, b) => priorityRank[a.task.priority] - priorityRank[b.task.priority] || a.index - b.index)
    .map(item => item.task);
}

function priorityOptions(current) {
  return ['高', '中', '低'].map(value => `<option value="${value}" ${current === value ? 'selected' : ''}>${value}优先级</option>`).join('');
}

function tagsHtml(task) {
  return `<div class="tags-editor">${task.tags.map(tag => `
    <span class="custom-tag" style="--tag-color:${validColor(tag.color)}">
      <input class="tag-text" data-tag-text="${task.id}" data-tag-id="${tag.id}" value="${escapeHtml(tag.label)}" maxlength="20" placeholder="输入标签" aria-label="修改标签" />
      <input class="tag-color" data-tag-color="${task.id}" data-tag-id="${tag.id}" type="color" value="${validColor(tag.color)}" aria-label="选择标签颜色" />
      <button class="tag-remove" data-tag-remove="${task.id}" data-tag-id="${tag.id}" aria-label="删除标签">×</button>
    </span>`).join('')}
    <select class="tag-reuse-inline" data-tag-reuse="${task.id}" aria-label="复用已有标签"><option value="">＋ 已有标签</option>${reusableTagOptions(task)}</select>
    <button class="tag-add" data-tag-add="${task.id}">＋ 新标签</button>
  </div>`;
}

function timeHtml(task) {
  if (!task.hasTime) return `<div class="time-editor"><button class="time-toggle" data-time-add="${task.id}">＋ 添加时间</button><span>当前无具体时间</span></div>`;
  return `<div class="time-editor"><input class="time-input" data-start-time="${task.id}" type="time" value="${task.startTime || ''}" aria-label="开始时间" /><span>至</span><input class="time-input" data-end-time="${task.id}" type="time" value="${task.endTime || ''}" aria-label="结束时间" /><button class="time-toggle" data-time-remove="${task.id}">移除时间</button></div>`;
}

function progressAndMarkerHtml(task) {
  const finished = task.progress === 100;
  return `<div class="task-progress"><span>当前进展</span><div class="cow-progress ${finished ? 'is-finished' : ''}" style="--progress:${task.progress}%"><div class="grass-track"></div><span class="cow-runner">🐄</span><span class="cow-bubble" aria-hidden="true">吃完啦</span><input data-progress="${task.id}" type="range" min="0" max="100" step="5" value="${task.progress}" aria-label="任务进展" /></div><output data-progress-output="${task.id}">${finished ? '100% 吃饱啦' : `${task.progress}% 🌿`}</output></div>`;
}

function renderWeeklySummary(visibleWeek) {
  const weekIsos = new Set(visibleWeek.map(toISO));
  const weekTasks = state.tasks.filter(task => weekIsos.has(task.date));
  const averageProgress = weekTasks.length ? Math.round(weekTasks.reduce((sum, task) => sum + task.progress, 0) / weekTasks.length) : 0;
  document.getElementById('summaryTitle').textContent = `${visibleWeek[0].getMonth() + 1}月${visibleWeek[0].getDate()}日–${visibleWeek[6].getMonth() + 1}月${visibleWeek[6].getDate()}日`;
  document.getElementById('cnCount').textContent = weekTasks.length;
  document.getElementById('osCount').textContent = `${averageProgress}%`;
  document.getElementById('doneCount').textContent = weekTasks.filter(task => task.done).length;
  document.getElementById('todoCount').textContent = weekTasks.filter(task => !task.done).length;
  const tagSummary = new Map();
  weekTasks.forEach(task => task.tags.forEach(tag => { const current = tagSummary.get(tag.label) || { count: 0, color: tag.color }; current.count += 1; tagSummary.set(tag.label, current); }));
  const tagLines = [...tagSummary.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 6).map(([label, info]) => `<div><span class="dot" style="background:${validColor(info.color)}"></span>${escapeHtml(label)} · ${info.count} 项</div>`).join('');
  document.getElementById('weeklyInsights').innerHTML = `${tagLines || '<div>本周暂无标签</div>'}<p>本周共 ${weekTasks.length} 项任务，平均进展 ${averageProgress}%，内容会随每周任务自动更新。</p>`;
}

function renderCalendar() {
  document.getElementById('calendarTitle').textContent = `${calendarMonth.getFullYear()}年 ${calendarMonth.getMonth() + 1}月`;
  const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - startOffset);
  const today = toISO(new Date());
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const iso = toISO(date);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    const classes = ['calendar-day'];
    if (date.getMonth() !== calendarMonth.getMonth()) classes.push('outside');
    if (weekend) classes.push('weekend');
    if (iso === selected) classes.push('selected');
    if (iso === today) classes.push('today');
    const dayTasks = state.tasks.filter(task => task.date === iso);
    const colors = dayTasks.length ? ['#db6d3a'] : [];
    dayTasks.filter(task => task.calendarMark).forEach(task => colors.push(task.markerColor));
    const uniqueColors = [...new Set(colors)].slice(0, 3);
    const markedTitles = dayTasks.filter(task => task.calendarMark).map(task => task.title).filter(Boolean);
    if (uniqueColors.length) classes.push('has-tasks');
    const markers = uniqueColors.length ? `<span class="calendar-markers">${uniqueColors.map(color => `<i style="--marker:${validColor(color)}"></i>`).join('')}</span>` : '';
    const title = markedTitles.length ? ` title="特别事件：${escapeHtml(markedTitles.join('、'))}"` : '';
    cells.push(`<button class="${classes.join(' ')}" data-calendar-date="${iso}"${title}><span class="calendar-number">${date.getDate()}</span>${markers}</button>`);
  }
  document.getElementById('calendarGrid').innerHTML = cells.join('');
  document.querySelectorAll('[data-calendar-date]:not(:disabled)').forEach(button => {
    button.onclick = () => { selected = button.dataset.calendarDate; calendarMonth = new Date(fromISO(selected).getFullYear(), fromISO(selected).getMonth(), 1); render(); };
  });
}

function bindTaskEvents() {
  document.querySelectorAll('[data-check]').forEach(button => {
    button.onclick = () => {
      const task = state.tasks.find(item => item.id === button.dataset.check);
      task.done = !task.done;
      if (task.done) task.progress = 100;
      else if (task.progress === 100) task.progress = 90;
      const sameDay = state.tasks.filter(item => item.date === task.date);
      const completedAll = task.done && sameDay.length > 0 && sameDay.every(item => item.done);
      save();
      render();
      if (completedAll) { launchConfetti(); showToast('全部完成！太棒了 🎉'); }
    };
  });
  document.querySelectorAll('[data-delete]').forEach(button => {
    button.onclick = () => { state.tasks = state.tasks.filter(item => item.id !== button.dataset.delete); save(); render(); showToast('任务已删除'); };
  });
  document.querySelectorAll('[data-task-title]').forEach(input => {
    input.oninput = () => { const task = state.tasks.find(item => item.id === input.dataset.taskTitle); task.title = input.value; save(); };
    input.onchange = () => { const task = state.tasks.find(item => item.id === input.dataset.taskTitle); task.title = input.value.trim() || '未命名任务'; save(); render(); };
  });
  document.querySelectorAll('[data-priority]').forEach(select => {
    select.onchange = () => { const task = state.tasks.find(item => item.id === select.dataset.priority); task.priority = select.value; save(); render(); showToast(`已调整为${select.value}优先级`); };
  });
  document.querySelectorAll('[data-note]').forEach(textarea => {
    textarea.oninput = () => { state.tasks.find(item => item.id === textarea.dataset.note).note = textarea.value; save(); };
  });
  document.querySelectorAll('[data-tag-text]').forEach(input => {
    input.oninput = () => { const task = state.tasks.find(item => item.id === input.dataset.tagText); task.tags.find(tag => tag.id === input.dataset.tagId).label = input.value; save(false); };
    input.onchange = () => { const task = state.tasks.find(item => item.id === input.dataset.tagText); task.tags.find(tag => tag.id === input.dataset.tagId).label = input.value.trim() || '标签'; save(); render(); };
  });
  document.querySelectorAll('[data-tag-color]').forEach(input => {
    input.oninput = () => { const task = state.tasks.find(item => item.id === input.dataset.tagColor); task.tags.find(tag => tag.id === input.dataset.tagId).color = input.value; input.closest('.custom-tag').style.setProperty('--tag-color', input.value); save(); };
  });
  document.querySelectorAll('[data-tag-remove]').forEach(button => {
    button.onclick = () => { const task = state.tasks.find(item => item.id === button.dataset.tagRemove); task.tags = task.tags.filter(tag => tag.id !== button.dataset.tagId); save(); render(); };
  });
  document.querySelectorAll('[data-tag-add]').forEach(button => {
    button.onclick = () => { const task = state.tasks.find(item => item.id === button.dataset.tagAdd); task.tags.push({ id: tagId(), label: '', color: '#8b5cf6' }); save(false); render(); };
  });
  document.querySelectorAll('[data-tag-reuse]').forEach(select => {
    select.onchange = () => {
      if (!select.value) return;
      const label = select.value;
      const task = state.tasks.find(item => item.id === select.dataset.tagReuse);
      task.tags.push(tagFromInput(label, '#6b7280'));
      save();
      render();
      showToast(`已添加标签「${label}」`);
    };
  });
  document.querySelectorAll('[data-time-add]').forEach(button => {
    button.onclick = () => { const task = state.tasks.find(item => item.id === button.dataset.timeAdd); task.hasTime = true; task.startTime = '09:00'; task.endTime = '10:00'; save(); render(); };
  });
  document.querySelectorAll('[data-time-remove]').forEach(button => {
    button.onclick = () => { const task = state.tasks.find(item => item.id === button.dataset.timeRemove); task.hasTime = false; task.startTime = ''; task.endTime = ''; save(); render(); };
  });
  document.querySelectorAll('[data-start-time]').forEach(input => { input.onchange = () => { state.tasks.find(item => item.id === input.dataset.startTime).startTime = input.value; save(); }; });
  document.querySelectorAll('[data-end-time]').forEach(input => { input.onchange = () => { state.tasks.find(item => item.id === input.dataset.endTime).endTime = input.value; save(); }; });
  document.querySelectorAll('[data-progress]').forEach(input => {
    input.oninput = () => {
      const task = state.tasks.find(item => item.id === input.dataset.progress);
      const wasFinished = task.progress === 100;
      task.progress = Number(input.value);
      const progress = input.closest('.cow-progress');
      const finished = task.progress === 100;
      progress.style.setProperty('--progress', `${task.progress}%`);
      progress.classList.toggle('is-finished', finished);
      if (finished && !wasFinished) {
        progress.classList.remove('is-eating');
        void progress.offsetWidth;
        progress.classList.add('is-eating');
      } else if (!finished) {
        progress.classList.remove('is-eating');
      }
      document.querySelector(`[data-progress-output="${task.id}"]`).textContent = finished ? '100% 吃饱啦' : `${task.progress}% 🌿`;
      save();
      renderWeeklySummary(weekDates(fromISO(selected)));
    };
  });
}

function render() {
  const now = new Date();
  const todayIso = toISO(now);
  const automaticDate = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 · ${weekday[now.getDay()]}`;
  document.getElementById('headerKicker').textContent = state.settings.headerKicker;
  document.getElementById('appTitle').textContent = state.settings.appTitle;
  document.getElementById('todayDate').textContent = state.settings.dateLine || automaticDate;
  document.title = state.settings.appTitle;
  document.getElementById('progressTitle').textContent = state.settings.progressTitle;
  document.getElementById('addButtonLabel').textContent = state.settings.addButtonLabel;

  const visibleWeek = weekDates(fromISO(selected));
  document.getElementById('tabs').innerHTML = visibleWeek.map(date => {
    const iso = toISO(date);
    const count = state.tasks.filter(task => task.date === iso && !task.done).length;
    return `<button class="day-tab ${selected === iso ? 'active' : ''}" data-date="${iso}"><b>${weekday[date.getDay()]}</b>${date.getMonth() + 1}月${date.getDate()}日 · ${count} 项</button>`;
  }).join('');
  document.querySelectorAll('.day-tab').forEach(button => { button.onclick = () => { selected = button.dataset.date; calendarMonth = new Date(fromISO(selected).getFullYear(), fromISO(selected).getMonth(), 1); render(); }; });

  const dayTasks = sortedTasks(state.tasks.filter(task => task.date === selected));
  const selectedDate = fromISO(selected);
  document.getElementById('listTitle').textContent = `${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日 · ${weekday[selectedDate.getDay()]}`;
  document.getElementById('taskCount').textContent = `${dayTasks.filter(task => !task.done).length} 项待完成`;
  document.getElementById('taskList').innerHTML = dayTasks.length ? dayTasks.map(task => `
    <div class="task ${task.done ? 'done' : ''}">
      <button class="check ${task.done ? 'done' : ''}" data-check="${task.id}" aria-label="标记完成">${task.done ? '✓' : ''}</button>
      <div class="task-main">
        <input class="task-title-input" data-task-title="${task.id}" value="${escapeHtml(task.title)}" maxlength="80" aria-label="修改任务标题" />
        <div class="meta">${tagsHtml(task)}<select class="priority-select ${task.priority === '高' ? 'high' : task.priority === '低' ? 'low' : ''}" data-priority="${task.id}">${priorityOptions(task.priority)}</select></div>
        ${timeHtml(task)}
        ${progressAndMarkerHtml(task)}
        <textarea class="note-input" data-note="${task.id}" rows="1" maxlength="500" placeholder="添加备注、链接或进展…">${escapeHtml(task.note || '')}</textarea>
      </div>
      <button class="delete" data-delete="${task.id}" aria-label="删除">删除</button>
    </div>`).join('') : '<div class="empty">这一天没有工作记录，可以添加一项新任务。</div>';
  bindTaskEvents();

  const todays = state.tasks.filter(task => task.date === todayIso);
  const done = todays.filter(task => task.done).length;
  const percent = todays.length ? Math.round(done / todays.length * 100) : 100;
  document.getElementById('todaySummary').textContent = todays.length ? (done === todays.length ? `今天 ${todays.length} 项全部完成！` : `今天完成 ${done} / ${todays.length} 项`) : '今天没有安排，保持轻松';
  document.getElementById('progressBar').style.width = `${Math.max(percent, 1)}%`;
  document.getElementById('progressText').textContent = `${percent}%`;
  const remaining = sortedTasks(todays.filter(task => !task.done));
  document.getElementById('focusNumber').textContent = remaining.length ? `${remaining.length} 项` : '—';
  document.getElementById('focusTitle').textContent = remaining[0]?.title || '今天的工作已完成';

  renderWeeklySummary(visibleWeek);
  renderCalendar();
}

function beginInlineEdit(elementId, settingKey, maxLength, allowEmpty = false) {
  const element = document.getElementById(elementId);
  const original = state.settings[settingKey];
  element.contentEditable = 'true';
  element.classList.add('is-editing');
  element.focus();
  const range = document.createRange();
  range.selectNodeContents(element);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);

  const finish = saveChange => {
    const value = element.textContent.trim().slice(0, maxLength);
    element.contentEditable = 'false';
    element.classList.remove('is-editing');
    element.onblur = null;
    element.onkeydown = null;
    state.settings[settingKey] = saveChange ? (value || (allowEmpty ? '' : original)) : original;
    save();
    render();
  };
  element.onblur = () => finish(true);
  element.onkeydown = event => {
    if (event.key === 'Enter') { event.preventDefault(); element.blur(); }
    if (event.key === 'Escape') { event.preventDefault(); finish(false); }
  };
}

document.getElementById('editProgressTitle').onclick = () => beginInlineEdit('progressTitle', 'progressTitle', 30);
document.getElementById('editHeaderKicker').onclick = () => beginInlineEdit('headerKicker', 'headerKicker', 50);
document.getElementById('editAppTitle').onclick = () => beginInlineEdit('appTitle', 'appTitle', 30);
document.getElementById('editDateLine').onclick = () => beginInlineEdit('todayDate', 'dateLine', 50, true);
document.getElementById('editAddButton').onclick = event => {
  event.stopPropagation();
  beginInlineEdit('addButtonLabel', 'addButtonLabel', 20);
};

const modal = document.getElementById('modalBackdrop');
document.getElementById('addBtn').onclick = event => {
  if (event.target.id === 'editAddButton' || document.getElementById('addButtonLabel').isContentEditable) return;
  const dateField = document.getElementById('dateInput');
  const days = weekDates(fromISO(selected));
  dateField.value = selected;
  dateField.min = toISO(days[0]);
  dateField.max = toISO(days[6]);
  refreshReusableTagInputs();
  modal.classList.add('show');
  setTimeout(() => document.getElementById('titleInput').focus(), 50);
};
document.getElementById('cancelBtn').onclick = () => modal.classList.remove('show');
modal.onclick = event => { if (event.target === modal) modal.classList.remove('show'); };
document.getElementById('timeModeInput').onchange = event => { document.getElementById('timeFields').classList.toggle('show', event.target.value === 'timed'); };

const weeklyModal = document.getElementById('weeklyModalBackdrop');
document.getElementById('weeklyBtn').onclick = () => {
  document.getElementById('weeklyStartInput').value = toISO(mondayOf(fromISO(selected)));
  refreshReusableTagInputs();
  weeklyModal.classList.add('show');
  setTimeout(() => document.getElementById('weeklyTasksInput').focus(), 50);
};
document.getElementById('tagReuseInput').onchange = event => {
  const tag = findReusableTag(event.target.value);
  if (!tag) return;
  document.getElementById('tagInput').value = tag.label;
  document.getElementById('tagColorInput').value = tag.color;
};
document.getElementById('weeklyTagReuseInput').onchange = event => {
  const tag = findReusableTag(event.target.value);
  document.getElementById('weeklyTagInput').value = tag?.label || '';
};
document.getElementById('weeklyCancelBtn').onclick = () => weeklyModal.classList.remove('show');
weeklyModal.onclick = event => { if (event.target === weeklyModal) weeklyModal.classList.remove('show'); };

const minutesToTime = minutes => `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
document.getElementById('weeklyTaskForm').onsubmit = event => {
  event.preventDefault();
  const titles = document.getElementById('weeklyTasksInput').value.split(/\n+/).map(value => value.trim()).filter(Boolean).slice(0, 50);
  if (!titles.length) { showToast('请至少填写一项每周任务'); return; }
  const monday = mondayOf(fromISO(document.getElementById('weeklyStartInput').value));
  const availableDays = weekDates(monday).slice(0, document.getElementById('weeklyRangeInput').value === 'allweek' ? 7 : 5);
  const [hour, minute] = document.getElementById('weeklyTimeInput').value.split(':').map(Number);
  const baseMinutes = hour * 60 + minute;
  const duration = Number(document.getElementById('weeklyDurationInput').value);
  const label = document.getElementById('weeklyTagInput').value.trim();
  const priority = document.getElementById('weeklyPriorityInput').value;
  const batchId = Date.now();
  const generated = titles.map((title, index) => {
    const date = availableDays[index % availableDays.length];
    const round = Math.floor(index / availableDays.length);
    const startMinutes = Math.min(baseMinutes + round * (duration + 30), 22 * 60 - duration);
    return normalizeTask({ id: `weekly-${batchId}-${index}`, date: toISO(date), title, category: label || '工作', tags: label ? [tagFromInput(label, '#6b7280')] : [], priority, note: '由每周任务自动安排，可继续人工修改。', progress: 0, calendarMark: false, markerColor: '#8b5cf6', hasTime: true, startTime: minutesToTime(startMinutes), endTime: minutesToTime(startMinutes + duration), done: false, fixed: false });
  });
  state.tasks.push(...generated);
  selected = generated[0].date;
  calendarMonth = new Date(fromISO(selected).getFullYear(), fromISO(selected).getMonth(), 1);
  save();
  render();
  event.target.reset();
  weeklyModal.classList.remove('show');
  showToast(`已自动安排 ${generated.length} 项每周任务`);
};

document.getElementById('taskForm').onsubmit = event => {
  event.preventDefault();
  const date = document.getElementById('dateInput').value;
  if (!weekDates(fromISO(selected)).some(day => toISO(day) === date)) { showToast('请选择当前查看周的日期'); return; }
  const label = document.getElementById('tagInput').value.trim();
  const hasTime = document.getElementById('timeModeInput').value === 'timed';
  state.tasks.push(normalizeTask({
    id: `custom-${Date.now()}`,
    date,
    title: document.getElementById('titleInput').value.trim(),
    category: label || '工作',
    tags: label ? [tagFromInput(label, document.getElementById('tagColorInput').value)] : [],
    priority: document.getElementById('priorityInput').value,
    note: document.getElementById('noteInput').value.trim(),
    progress: 0,
    calendarMark: document.getElementById('markerModeInput').value === 'marked',
    markerColor: document.getElementById('markerColorInput').value,
    hasTime,
    startTime: hasTime ? document.getElementById('startTimeInput').value : '',
    endTime: hasTime ? document.getElementById('endTimeInput').value : '',
    done: false,
    fixed: false
  }));
  selected = date;
  save();
  render();
  event.target.reset();
  document.getElementById('tagInput').value = '';
  document.getElementById('tagReuseInput').value = '';
  document.getElementById('tagColorInput').value = '#6b7280';
  document.getElementById('timeFields').classList.remove('show');
  document.getElementById('markerModeInput').value = 'none';
  document.getElementById('markerColorInput').value = '#8b5cf6';
  modal.classList.remove('show');
  showToast('任务已添加');
};

document.getElementById('prevMonth').onclick = () => { calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1); renderCalendar(); };
document.getElementById('nextMonth').onclick = () => { calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1); renderCalendar(); };
document.getElementById('currentWeekBtn').onclick = () => { ensureCurrentWeek(); selected = defaultSelectedDate(); calendarMonth = new Date(fromISO(selected).getFullYear(), fromISO(selected).getMonth(), 1); render(); };
document.getElementById('updateBtn').onclick = () => {
  const bridge = window.webkit?.messageHandlers?.dogCowUpdater;
  if (bridge) bridge.postMessage({ action: 'check' });
  else showToast('请在狗牛桌面 App 中检查更新');
};

render();
setInterval(() => {
  const latestWeek = weekKey(new Date());
  if (latestWeek !== currentAutoWeek) {
    ensureCurrentWeek();
    currentAutoWeek = latestWeek;
    selected = defaultSelectedDate();
    calendarMonth = new Date(fromISO(selected).getFullYear(), fromISO(selected).getMonth(), 1);
    render();
  }
}, 60 * 60 * 1000);
