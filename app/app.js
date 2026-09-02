const STORAGE_KEY = 'work-todolist-generic-v1';
const LEGACY_KEYS = [];
const pad = n => String(n).padStart(2, '0');
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = value => new Date(`${value}T12:00:00`);
const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const priorityRank = { 高: 0, 中: 1, 低: 2 };
const defaultSettings = { headerKicker: 'Weekly operations desk', appTitle: '狗牛', dateLine: '', progressTitle: '今日完成度', addButtonLabel: '新增任务' };
const tagColors = {};
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

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
const validISODate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const parsed = fromISO(value);
  return !Number.isNaN(parsed.getTime()) && toISO(parsed) === value;
};
const addDaysISO = (value, days) => {
  const date = fromISO(value);
  return toISO(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
};
const daysBetween = (start, end) => Math.round((fromISO(end) - fromISO(start)) / 86400000);
function moveTaskToNextDay(task) {
  if (!task || task.done || !validISODate(task.date)) return '';
  const nextDate = addDaysISO(task.date, 1);
  task.date = nextDate;
  if (task.dueDate && task.dueDate < nextDate) task.dueDate = nextDate;
  return nextDate;
}
const normalizeTag = tag => ({ label: String(tag?.label || '').trim().slice(0, 20), color: validColor(tag?.color) });

function mergeTagLibrary(savedTags, tasks) {
  const library = new Map();
  const add = tag => {
    const normalized = normalizeTag(tag);
    if (!normalized.label) return;
    const key = normalized.label.toLocaleLowerCase('zh-CN');
    if (!library.has(key)) library.set(key, normalized);
  };
  (Array.isArray(savedTags) ? savedTags : []).forEach(add);
  tasks.forEach(task => (task.tags || []).forEach(add));
  return [...library.values()];
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
    endTime: task.endTime || '',
    dueDate: validISODate(task.dueDate) ? task.dueDate : ''
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
      return { tasks, tagLibrary: mergeTagLibrary(saved.tagLibrary, tasks), seededWeeks: saved.seededWeeks || [], settings: { ...defaultSettings, ...(saved.settings || {}) } };
    }
  } catch {}

  for (const key of LEGACY_KEYS) {
    try {
      const legacy = JSON.parse(localStorage.getItem(key));
      if (legacy && Array.isArray(legacy.tasks)) {
        const tasks = legacy.tasks.map(normalizeTask);
        return {
          tasks,
          tagLibrary: mergeTagLibrary([], tasks),
          seededWeeks: legacy.seededWeeks || (legacy.week ? [legacy.week] : []),
          settings: { ...defaultSettings }
        };
      }
    } catch {}
  }
  return { tasks: [], tagLibrary: [], seededWeeks: [], settings: { ...defaultSettings } };
}

let state = loadState();
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
const celebratingTasks = new Set();

function rememberTag(label, color) {
  const normalized = normalizeTag({ label, color });
  if (!normalized.label) return null;
  const existing = state.tagLibrary.find(tag => tag.label.toLocaleLowerCase('zh-CN') === normalized.label.toLocaleLowerCase('zh-CN'));
  if (existing) {
    existing.label = normalized.label;
    existing.color = normalized.color;
    return existing;
  }
  state.tagLibrary.push(normalized);
  return normalized;
}

function savedTag(label) {
  const key = String(label || '').trim().toLocaleLowerCase('zh-CN');
  return state.tagLibrary.find(tag => tag.label.toLocaleLowerCase('zh-CN') === key);
}

function tagLibraryOptions() {
  return state.tagLibrary.map(tag => `<option value="${escapeHtml(tag.label)}">${escapeHtml(tag.label)}</option>`).join('');
}

function renderTagLibrary() {
  const list = document.getElementById('tagLibraryOptions');
  if (list) list.innerHTML = tagLibraryOptions();
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
  if (reducedMotionQuery.matches) {
    layer.innerHTML = '';
    return;
  }
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
      <input class="tag-text" data-tag-text="${task.id}" data-tag-id="${tag.id}" value="${escapeHtml(tag.label)}" maxlength="20" aria-label="修改标签" />
      <input class="tag-color" data-tag-color="${task.id}" data-tag-id="${tag.id}" type="color" value="${validColor(tag.color)}" aria-label="选择标签颜色" />
      <button class="tag-remove" data-tag-remove="${task.id}" data-tag-id="${tag.id}" aria-label="删除标签">×</button>
    </span>`).join('')}<select class="tag-reuse" data-tag-reuse="${task.id}" aria-label="复用已有标签"><option value="">＋ 复用标签</option>${tagLibraryOptions()}<option value="__new__">＋ 新建标签</option></select></div>`;
}

function timeHtml(task) {
  if (!task.hasTime) return `<div class="time-editor"><button class="time-toggle" data-time-add="${task.id}">＋ 添加时间</button><span>当前无具体时间</span></div>`;
  return `<div class="time-editor"><input class="time-input" data-start-time="${task.id}" type="time" value="${task.startTime || ''}" aria-label="开始时间" /><span>至</span><input class="time-input" data-end-time="${task.id}" type="time" value="${task.endTime || ''}" aria-label="结束时间" /><button class="time-toggle" data-time-remove="${task.id}">移除时间</button></div>`;
}

function deadlineHtml(task) {
  if (!task.dueDate) {
    return `<div class="deadline-editor"><button class="deadline-toggle" data-deadline-add="${task.id}">＋ 设置截止日期</button><span class="deadline-hint">当前无截止日期</span></div>`;
  }
  const today = toISO(new Date());
  const remainingDays = daysBetween(today, task.dueDate);
  let status = task.done ? '已完成' : remainingDays < 0 ? `已过期 ${Math.abs(remainingDays)} 天` : remainingDays === 0 ? '今天截止' : `剩余 ${remainingDays} 天`;
  const statusClass = task.done ? 'done' : remainingDays < 0 ? 'overdue' : remainingDays === 0 ? 'today' : '';
  return `<div class="deadline-editor"><span class="deadline-label">截止日期</span><input class="deadline-input" data-deadline-date="${task.id}" type="date" min="${task.date}" value="${task.dueDate}" aria-label="截止日期" /><button class="deadline-toggle" data-deadline-remove="${task.id}">移除</button><span class="deadline-status ${statusClass}">${status}</span></div>`;
}

function taskMatchesDate(task, iso) {
  return task.date === iso || Boolean(task.dueDate && task.dueDate === iso);
}

function progressAndMarkerHtml(task) {
  const complete = task.progress === 100;
  const celebrating = celebratingTasks.has(task.id);
  return `<div class="task-progress ${complete ? 'complete' : ''} ${celebrating ? 'celebrating' : ''}"><span>当前进展</span><div class="cow-progress" style="--progress:${task.progress}%"><div class="grass-track"></div><span class="cow-runner" aria-hidden="true">🐄</span><input data-progress="${task.id}" type="range" min="0" max="100" step="5" value="${task.progress}" aria-label="任务进展" /></div><output data-progress-output="${task.id}">${complete ? '<span class="completion-feedback"><b>吃完啦</b><i>✨</i></span>' : `${task.progress}% 🌿`}</output></div>`;
}

function renderWeeklySummary(visibleWeek) {
  const weekIsos = new Set(visibleWeek.map(toISO));
  const weekTasks = state.tasks.filter(task => [...weekIsos].some(iso => taskMatchesDate(task, iso)));
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
    const deadlineTasks = state.tasks.filter(task => task.dueDate === iso);
    const matchedTasks = state.tasks.filter(task => taskMatchesDate(task, iso));
    const colors = dayTasks.length ? ['#db6d3a'] : [];
    if (deadlineTasks.length) colors.push('#b84235');
    dayTasks.filter(task => task.calendarMark).forEach(task => colors.push(task.markerColor));
    const uniqueColors = [...new Set(colors)].slice(0, 3);
    const markedTitles = dayTasks.filter(task => task.calendarMark).map(task => task.title).filter(Boolean);
    const deadlineTitles = deadlineTasks.map(task => task.title).filter(Boolean);
    if (uniqueColors.length) classes.push('has-tasks');
    const markers = uniqueColors.length ? `<span class="calendar-markers">${uniqueColors.map(color => `<i style="--marker:${validColor(color)}"></i>`).join('')}</span>` : '';
    const titleParts = [];
    if (markedTitles.length) titleParts.push(`特别事件：${markedTitles.join('、')}`);
    if (deadlineTitles.length) titleParts.push(`截止：${deadlineTitles.join('、')}`);
    const title = titleParts.length ? ` title="${escapeHtml(titleParts.join('；'))}"` : '';
    cells.push(`<button class="${classes.join(' ')}" data-calendar-date="${iso}" data-matched-tasks="${matchedTasks.length}"${title}><span class="calendar-number">${date.getDate()}</span>${markers}</button>`);
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
      if (task.done) celebratingTasks.add(task.id);
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
    input.oninput = () => { const task = state.tasks.find(item => item.id === input.dataset.tagText); task.tags.find(tag => tag.id === input.dataset.tagId).label = input.value; save(); };
    input.onchange = () => { const task = state.tasks.find(item => item.id === input.dataset.tagText); const tag = task.tags.find(item => item.id === input.dataset.tagId); tag.label = input.value.trim() || '标签'; rememberTag(tag.label, tag.color); save(); render(); };
  });
  document.querySelectorAll('[data-tag-color]').forEach(input => {
    input.oninput = () => { const task = state.tasks.find(item => item.id === input.dataset.tagColor); const tag = task.tags.find(item => item.id === input.dataset.tagId); tag.color = input.value; rememberTag(tag.label, tag.color); input.closest('.custom-tag').style.setProperty('--tag-color', input.value); save(); };
  });
  document.querySelectorAll('[data-tag-remove]').forEach(button => {
    button.onclick = () => { const task = state.tasks.find(item => item.id === button.dataset.tagRemove); task.tags = task.tags.filter(tag => tag.id !== button.dataset.tagId); save(); render(); };
  });
  document.querySelectorAll('[data-tag-reuse]').forEach(select => {
    select.onchange = () => {
      if (!select.value) return;
      const task = state.tasks.find(item => item.id === select.dataset.tagReuse);
      if (select.value === '__new__') {
        task.tags.push({ id: tagId(), label: '新标签', color: '#8b5cf6' });
      } else {
        const reusable = savedTag(select.value);
        if (reusable && !task.tags.some(tag => tag.label.toLocaleLowerCase('zh-CN') === reusable.label.toLocaleLowerCase('zh-CN'))) {
          task.tags.push({ id: tagId(), label: reusable.label, color: reusable.color });
        }
      }
      save();
      render();
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
  document.querySelectorAll('[data-deadline-add]').forEach(button => {
    button.onclick = () => { const task = state.tasks.find(item => item.id === button.dataset.deadlineAdd); task.dueDate = task.date; save(); render(); };
  });
  document.querySelectorAll('[data-deadline-remove]').forEach(button => {
    button.onclick = () => { const task = state.tasks.find(item => item.id === button.dataset.deadlineRemove); task.dueDate = ''; save(); render(); showToast('截止日期已移除'); };
  });
  document.querySelectorAll('[data-deadline-date]').forEach(input => {
    input.onchange = () => {
      const task = state.tasks.find(item => item.id === input.dataset.deadlineDate);
      task.dueDate = validISODate(input.value) ? input.value : '';
      if (task.dueDate && task.dueDate < task.date) task.dueDate = task.date;
      save();
      render();
    };
  });
  document.querySelectorAll('[data-sync-next-day]').forEach(button => {
    button.onclick = () => {
      const task = state.tasks.find(item => item.id === button.dataset.syncNextDay);
      const nextDate = moveTaskToNextDay(task);
      if (!nextDate) return;
      selected = nextDate;
      calendarMonth = new Date(fromISO(selected).getFullYear(), fromISO(selected).getMonth(), 1);
      save();
      render();
      showToast(`已同步到 ${fromISO(nextDate).getMonth() + 1}月${fromISO(nextDate).getDate()}日`);
    };
  });
  document.querySelectorAll('[data-progress]').forEach(input => {
    input.oninput = () => {
      const task = state.tasks.find(item => item.id === input.dataset.progress);
      task.progress = Number(input.value);
      task.done = task.progress === 100;
      input.closest('.cow-progress').style.setProperty('--progress', `${task.progress}%`);
      document.querySelector(`[data-progress-output="${task.id}"]`).textContent = task.done ? '吃完啦 ✨' : `${task.progress}% 🌿`;
      save();
      renderWeeklySummary(weekDates(fromISO(selected)));
    };
    input.onchange = () => {
      const task = state.tasks.find(item => item.id === input.dataset.progress);
      if (task.done) celebratingTasks.add(task.id);
      render();
      if (task.done) {
        showToast('🐄 吃完啦！');
        const sameDay = state.tasks.filter(item => item.date === task.date);
        if (sameDay.length && sameDay.every(item => item.done)) launchConfetti();
      }
    };
  });
}

function render() {
  renderTagLibrary();
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
        ${deadlineHtml(task)}
        ${progressAndMarkerHtml(task)}
        <textarea class="note-input" data-note="${task.id}" rows="1" maxlength="500" placeholder="添加备注、链接或进展…">${escapeHtml(task.note || '')}</textarea>
      </div>
      <div class="task-actions">${task.done ? '' : `<button class="sync-next-day" data-sync-next-day="${task.id}" aria-label="同步到下一日" title="将任务顺延到下一天">同步到下一日</button>`}<button class="delete" data-delete="${task.id}" aria-label="删除">删除</button></div>
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
  celebratingTasks.clear();
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
  const dueDateField = document.getElementById('dueDateInput');
  dueDateField.value = '';
  dueDateField.min = selected;
  modal.classList.add('show');
  setTimeout(() => document.getElementById('titleInput').focus(), 50);
};
document.getElementById('cancelBtn').onclick = () => modal.classList.remove('show');
modal.onclick = event => { if (event.target === modal) modal.classList.remove('show'); };
document.getElementById('timeModeInput').onchange = event => { document.getElementById('timeFields').classList.toggle('show', event.target.value === 'timed'); };
document.getElementById('dateInput').onchange = event => {
  const dueDateField = document.getElementById('dueDateInput');
  dueDateField.min = event.target.value;
  if (dueDateField.value && dueDateField.value < event.target.value) dueDateField.value = event.target.value;
};

const weeklyModal = document.getElementById('weeklyModalBackdrop');
document.getElementById('weeklyBtn').onclick = () => {
  document.getElementById('weeklyStartInput').value = toISO(mondayOf(fromISO(selected)));
  weeklyModal.classList.add('show');
  setTimeout(() => document.getElementById('weeklyTasksInput').focus(), 50);
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
  const reusableTag = savedTag(label);
  const tagColor = reusableTag?.color || '#6b7280';
  const priority = document.getElementById('weeklyPriorityInput').value;
  const batchId = Date.now();
  const generated = titles.map((title, index) => {
    const date = availableDays[index % availableDays.length];
    const round = Math.floor(index / availableDays.length);
    const startMinutes = Math.min(baseMinutes + round * (duration + 30), 22 * 60 - duration);
    return normalizeTask({ id: `weekly-${batchId}-${index}`, date: toISO(date), title, category: label || '工作', tags: label ? [{ id: tagId(), label, color: tagColor }] : [], priority, note: '由每周任务自动安排，可继续人工修改。', progress: 0, calendarMark: false, markerColor: '#8b5cf6', hasTime: true, startTime: minutesToTime(startMinutes), endTime: minutesToTime(startMinutes + duration), done: false, fixed: false });
  });
  state.tasks.push(...generated);
  if (label) rememberTag(label, tagColor);
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
  const tagColor = document.getElementById('tagColorInput').value;
  const hasTime = document.getElementById('timeModeInput').value === 'timed';
  state.tasks.push(normalizeTask({
    id: `custom-${Date.now()}`,
    date,
    title: document.getElementById('titleInput').value.trim(),
    category: label || '工作',
    tags: label ? [{ id: tagId(), label, color: tagColor }] : [],
    priority: document.getElementById('priorityInput').value,
    note: document.getElementById('noteInput').value.trim(),
    progress: 0,
    calendarMark: document.getElementById('markerModeInput').value === 'marked',
    markerColor: document.getElementById('markerColorInput').value,
    hasTime,
    startTime: hasTime ? document.getElementById('startTimeInput').value : '',
    endTime: hasTime ? document.getElementById('endTimeInput').value : '',
    dueDate: document.getElementById('dueDateInput').value,
    done: false,
    fixed: false
  }));
  if (label) rememberTag(label, tagColor);
  selected = date;
  save();
  render();
  event.target.reset();
  document.getElementById('tagInput').value = '';
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

['tagInput', 'weeklyTagInput'].forEach(id => {
  document.getElementById(id).addEventListener('change', event => {
    const reusable = savedTag(event.target.value);
    if (reusable && id === 'tagInput') document.getElementById('tagColorInput').value = reusable.color;
  });
});

save();
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
