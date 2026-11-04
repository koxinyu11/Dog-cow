import { useState, type CSSProperties } from 'react';
import type { ModuleCtx } from '../../board/modules';
import type { Fields, Result } from '../../../shared/contracts';
import { defaultFun } from '../../../shared/fun';
import { defaultMoods, moodData, moodMessage, moodStreak, MOOD_COLORS, MOOD_EMOJIS, MOOD_REWARDS, type MoodOption } from '../../../shared/mood';
import { addDays } from '../../../domain/tasks/model';
import { Button, Emoji } from '../../ui';
import { Modal, Field } from '../../components/Modal';

export function MoodCard({ ctx, busy, run }: { ctx: ModuleCtx; busy: boolean; run: (p:Fields)=>Promise<Result|null> }) {
  const { today, size, state, openSettings } = ctx;
  const data = moodData(state.board.fun ?? defaultFun());
  const current = data.moods.find(m=>m.id===data.moodHistory[today]);
  const streak = moodStreak(data,today);
  const previous = data.moods.find(m=>m.id===streak.id);
  const earnedRewards = MOOD_REWARDS.filter(r=>data.wallpapers.includes(r.id));
  const active = data.moods.filter(m=>!m.archived);
  const [open,setOpen] = useState(false);
  const [draft,setDraft] = useState<MoodOption|null>(null);
  const [error,setError] = useState('');
  const [unlockNotice,setUnlockNotice] = useState('');
  const expanded = size==='l' || size==='tall' || size==='wide';
  const status = state.income.snapshot?.status;
  const pose = state.income.attendance.days.find(d=>d.date===today)?.clockOut ? '收工啦' : status==='paused' ? '干饭中' : status==='working' ? '营业中' : '歇一会儿';
  const choose = async (id:string) => {
    setUnlockNotice('');
    const result = await run({action:'mood',id});
    if (result) {
      setError('');
      if (result.code==='wallpaper-unlocked') setUnlockNotice(result.message);
      if(size==='s' && result.code!=='wallpaper-unlocked') setOpen(false);
    }
    else setError('状态未能保存，请重试。');
  };
  const history = <div className="mood-week" aria-label="近七天状态">{Array.from({length:7},(_,i)=>{
    const date=addDays(today,i-6); const mood=data.moods.find(m=>m.id===data.moodHistory[date]);
    return <div key={date} title={`${date} · ${mood?.name || '未记录'}`}><span>{date.slice(5)}</span><b>{mood?.emoji || '·'}</b><small>{mood?.name || '未选'}</small></div>;
  })}</div>;
  return <>
    <div className="fun-main mood-main" style={{'--mood-color':current?.color || '#629c71'} as CSSProperties}>
      <Emoji motion={status==='working' ? 'idle-walk':'idle-peek'}>{current?.emoji || '🐮'}</Emoji>
      <div><strong>{current?.name || '今天是什么状态？'}</strong><small>{pose}{streak.days>0 ? ` · ${streak.selectedToday?'连续':'截至昨天'} ${streak.days} 天` : ''}</small></div>
    </div>
    <div className="fun-actions mood-actions">
      {size!=='s' && active.slice(0,size==='m'?2:3).map(m=><Button key={m.id} size="sm" disabled={busy} aria-pressed={current?.id===m.id} onClick={()=>void choose(m.id)}>{m.emoji} {m.name}</Button>)}
      <Button size="sm" onClick={()=>{setOpen(true);setDraft(null);setError('');setUnlockNotice('');}}>切换状态</Button>
    </div>
    {expanded && <div className="fun-detail mood-detail"><p className="fun-quip">{moodMessage(current?.name || previous?.name || '营业',streak.days)}</p>{history}{earnedRewards.length>0&&<Button size="sm" variant="ghost" onClick={()=>openSettings('look')}>壁纸收藏 · {earnedRewards.length}</Button>}</div>}
    <Modal open={open} title="我的精神状态" onClose={()=>{if(!busy)setOpen(false);}}>
      <div className="mood-manager">
        {unlockNotice && <div className="mood-unlock-notice" role="status">{unlockNotice}</div>}
        {!draft ? <>
          <div className="mood-option-list">{data.moods.map(m=><div key={m.id} className={m.archived?'is-archived':''}>
            <Button disabled={busy||m.archived} aria-pressed={current?.id===m.id} onClick={()=>void choose(m.id)}>{m.emoji} {m.name}</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={()=>setDraft({...m})}>编辑</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={async()=>{if(!await run({action:'archive-mood',id:m.id}))setError('操作未保存，请检查可用状态数量后重试。');}}>{m.archived?'恢复':'归档'}</Button>
          </div>)}</div>
          <Button disabled={busy||active.length>=20} onClick={()=>setDraft({id:crypto.randomUUID(),name:'',emoji:defaultMoods()[0].emoji,color:MOOD_COLORS[0],archived:false})}>＋ 自定义状态</Button>
          <h3>近七天</h3>{history}
          <div className="mood-rewards">{earnedRewards.map(r=><div key={r.id}><span>{r.emoji} {r.name}</span><small>已解锁</small></div>)}</div>
          {earnedRewards.length>0&&<Button variant="ghost" onClick={()=>{setOpen(false);openSettings('look');}}>去背景里看看</Button>}
        </> : <form onSubmit={async e=>{e.preventDefault();if(await run({action:'save-mood',...draft})){setDraft(null);setError('');}else setError('未能保存：名称最多 12 字，可选状态最多 20 个。');}}>
          <Field label="状态名称（最多12字）"><input required maxLength={12} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} /></Field>
          <fieldset className="mood-palette"><legend>表情</legend>{MOOD_EMOJIS.map(emoji=><Button key={emoji} aria-pressed={draft.emoji===emoji} onClick={()=>setDraft({...draft,emoji})}>{emoji}</Button>)}</fieldset>
          <fieldset className="mood-palette"><legend>颜色</legend>{MOOD_COLORS.map(color=><button key={color} type="button" className="mood-color" style={{background:color}} aria-label={`颜色 ${color}`} aria-pressed={draft.color===color} onClick={()=>setDraft({...draft,color})} />)}</fieldset>
          <div className="dialog-actions"><Button disabled={busy} onClick={()=>setDraft(null)}>返回</Button><Button type="submit" variant="primary" disabled={busy}>保存状态</Button></div>
        </form>}
        <p className="error" role="alert">{error}</p>
      </div>
    </Modal>
  </>;
}
