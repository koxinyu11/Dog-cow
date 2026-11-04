import { formatDuration } from './calculator.js';
import { mountClockUI } from './clock-ui.js';
import sharedStyles from '../styles.css';

const money = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const labels = { working: '工作中', 'before-work': '尚未上班', 'after-work': '已下班', 'rest-day': '今日休息', 'paid-leave': '带薪请假', 'unpaid-leave': '扣薪请假', 'leave-day': '今日请假', paused: '午休中', 'pending-clock': '待补上班卡' };
const cardStyles = `
  :host { background: #fff; border-radius: 22px; }
  .widget-shell { padding: 22px; }
  h2 { font-size: 18px; }
  .metrics { gap: 10px; margin: 14px 0; }
  .metric { padding: 12px; }
  .metric-value { font-size: 26px; }
  .widget-actions { margin-top: 12px; }
  .clock-actions button { padding: 8px 12px; }
  .compact-clock #clock-history, .compact-clock details { display: none; }
  .theft-details { gap: 5px 16px; }
`;

export function mountIncomeWidgets({ hosts, controller, openSettings }) {
  const roots = {};
  const templates = {
    income: `<h2>实时收入</h2><div class="metrics"><div class="metric"><h3>今日已赚</h3><p class="metric-value" data-value="earnedToday">—</p></div><div class="metric"><h3>本月已赚</h3><p class="metric-value" data-value="earnedMonth">—</p></div></div><p class="help">秒薪 <strong data-value="perSecond">—</strong> 元 · 本月预计 <strong data-value="expectedMonthIncome">—</strong> 元</p>`,
    'work-time': `<div class="section-heading"><h2>工时与下班倒计时</h2><span class="status" data-status>待设置</span></div><div class="metrics"><div class="metric"><h3>距离规定下班</h3><p class="metric-value" data-value="remaining">—</p></div><div class="metric"><h3>今日已工作</h3><p class="metric-value" data-value="elapsed">—</p></div></div><p class="help">实际午休 <strong data-value="break">—</strong></p>`,
    stolen: `<h2>偷出金额</h2><div class="metrics"><div class="metric"><h3>今日合计</h3><p class="metric-value" data-value="stolenAmount">—</p></div><div class="metric"><h3>本月合计</h3><p class="metric-value" data-value="stolenMonthAmount">—</p></div></div><div class="theft-details"><p>午休 <strong data-value="lunchStolenAmount">—</strong> 元</p><p>上班晚 <strong data-value="lateAmount">—</strong> 元</p><p>下班早 <strong data-value="earlyAmount">—</strong> 元</p></div><p class="help">仅拆分时间价值，不额外加到工资。</p>`,
    clock: '<div class="compact-clock" data-clock></div>',
  };
  for (const [id, host] of Object.entries(hosts)) {
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${sharedStyles}\n${cardStyles}</style><div class="widget-shell">${templates[id]}<p class="help" data-feedback role="status"></p><div class="widget-actions"><button type="button" class="secondary" data-settings>计价设置</button></div></div>`;
    root.querySelector('[data-settings]').addEventListener('click', () => openSettings('income'));
    roots[id] = root;
  }
  const clock = mountClockUI(roots.clock.querySelector('[data-clock]'), {
    getState: () => controller.getState(),
    onCommit: (attendance) => controller.commitAttendance(attendance).applied,
  });
  const text = (node, value) => { if (node.textContent !== value) node.textContent = value; };
  const values = (root, entries) => {
    for (const [id, value] of Object.entries(entries)) text(root.querySelector(`[data-value="${id}"]`), value);
  };
  return controller.subscribe((state) => {
    const snapshot = state.snapshot;
    const feedback = !state.settings ? '先在设置中填写工资与排班。' : state.calculationError?.message ?? '';
    for (const root of Object.values(roots)) text(root.querySelector('[data-feedback]'), feedback);
    values(roots.income, {
      earnedToday: snapshot ? `¥${money.format(snapshot.earnedToday)}` : '—',
      earnedMonth: snapshot ? `¥${money.format(snapshot.earnedMonth)}` : '—',
      expectedMonthIncome: snapshot ? money.format(snapshot.expectedMonthIncome) : '—',
      perSecond: snapshot ? snapshot.perSecond.toFixed(6) : '—',
    });
    values(roots['work-time'], {
      remaining: snapshot ? (snapshot.status === 'rest-day' ? '今日休息' : snapshot.fullDayLeave ? '今日无需上班' : formatDuration(snapshot.remainingSeconds)) : '—',
      elapsed: snapshot ? formatDuration(snapshot.elapsedSeconds) : '—',
      break: snapshot ? formatDuration(snapshot.actualBreakSeconds) : '—',
    });
    text(roots['work-time'].querySelector('[data-status]'), snapshot ? labels[snapshot.status] : '待设置');
    const active = Boolean(state.settings?.stealMode && snapshot);
    values(roots.stolen, Object.fromEntries(['stolenAmount', 'stolenMonthAmount', 'lunchStolenAmount', 'lateAmount', 'earlyAmount'].map((key) => [key, active ? money.format(snapshot[key]) : '—'])));
    if (state.settings && !state.settings.stealMode) text(roots.stolen.querySelector('[data-feedback]'), '尚未开启偷时间模式，可到设置中开启。');
    else if (snapshot?.pendingClockIn) text(roots.stolen.querySelector('[data-feedback]'), '上班卡待补录，当前上班晚金额为暂估，补卡后重算。');
    clock.render();
  });
}
