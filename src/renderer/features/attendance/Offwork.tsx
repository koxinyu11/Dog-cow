import { useEffect } from 'react';
import { Hourglass, House, PartyPopper } from 'lucide-react';
import type { IncomeState } from '../../../shared/contracts';
import { offworkNotice } from '../../../shared/offwork';
import { Modal } from '../../components/Modal';
import { duration, money, time } from '../../format';
import { fx, motionAllowed } from '../../motion/fx';
import { Button } from '../../ui';
import './offwork.css';

export function OffworkNotice({ income, openClock }: { income: IncomeState; openClock: () => void }) {
  const notice = offworkNotice(income);
  if (!notice) return null;
  const remaining = `${String(Math.floor(notice.seconds / 60)).padStart(2, '0')}:${String(notice.seconds % 60).padStart(2, '0')}`;
  return <aside className={`offwork-notice ${motionAllowed() ? 'is-animated' : ''} is-${notice.kind}`}>
    {notice.kind === 'soon' ? <Hourglass size={20} /> : <House size={20} />}
    <strong>{notice.text}</strong>
    <span className="offwork-timer">{notice.kind === 'soon' ? remaining : `已过下班时间 ${Math.floor(notice.seconds / 60)} 分钟`}</span>
    {income.settings?.stealMode && income.settings.clockMode && <Button size="sm" onClick={openClock}>下班打卡</Button>}
  </aside>;
}

export function OffworkReceipt({ income, date, completedTasks, onClose }: { income: IncomeState; date: string; completedTasks: number; onClose: () => void }) {
  const s = income.snapshot!;
  const day = income.attendance.days.find((item) => item.date === date)!;
  const animated = motionAllowed();
  useEffect(() => { fx('offwork-finale', { x: innerWidth / 2, y: innerHeight / 3 }); }, []);
  const rows = [
    ['今日完成', `${completedTasks} 件任务`],
    ['上班打卡', time(day.clockIn?.at)], ['下班打卡', time(day.clockOut?.at)],
    ['今日已工作', duration(s.elapsedSeconds)],
    ...(income.settings?.stealMode ? [
      ['今日偷出', `¥${money(s.stolenAmount)}`],
    ] : []),
  ];
  return <Modal open title="今日打工，杀青！" className={`offwork-dialog ${animated ? 'is-animated' : ''}`} onClose={onClose}>
    <div className="offwork-printer"><span /></div>
    <div className="offwork-paper-window">
      <section className="offwork-paper">
        <div className="offwork-paper-brand"><PartyPopper size={24} /><span>狗牛 · 收工结算单</span></div>
        <p className="offwork-date">{date}</p>
        <div className="offwork-total"><span>今日计薪收入</span><strong>¥{money(s.earnedToday)}</strong></div>
        <dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl>
        <div className="offwork-stamp">今日已收工</div>
        <p className="offwork-footer">今天的努力已签收<br />接下来，快乐归你。</p>
      </section>
    </div>
    <div className="offwork-actions"><Button variant="primary" onClick={onClose}>收好，去生活</Button></div>
  </Modal>;
}
