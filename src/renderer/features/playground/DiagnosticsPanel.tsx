import { useEffect, useState } from 'react';
import { Button } from '../../ui';
import { validDiagnosticId, type DiagnosticReceipt, type DiagnosticView, type PlaygroundReport } from '../../../shared/playground-diagnostics';
import { localDiagnostics } from './game-diagnostics';
export function DiagnosticsPanel() {
  const [data, setData] = useState<DiagnosticView>({ entries: [] });
  const [id, setId] = useState('');
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const refresh = async () => {
    if (id && !validDiagnosticId(id)) { setMessage('请输入有效的问题编号。'); return; }
    try { const next = await window.playground.diagnostics(id || undefined); setData(next); setMessage(next.warning ?? (next.entries.length ? '' : '未找到诊断记录。')); }
    catch { setMessage('诊断服务暂时不可用，当前页面的记录仍可查看。'); }
  };
  useEffect(() => {
    const listen = (event: Event) => {
      const { report, receipt } = (event as CustomEvent<{ report: PlaygroundReport; receipt?: DiagnosticReceipt }>).detail;
      if (receipt?.warning) setNotice(receipt.warning);
      else if (!['render', 'load'].includes(report.stage)) setNotice(`发生异常（${report.stage}），问题编号：${report.correlationId}。可在错误诊断中查看。`);
    };
    window.addEventListener('playground:diagnostic', listen);
    return () => window.removeEventListener('playground:diagnostic', listen);
  }, []);
  return <aside className="pg-diagnostics">
    {notice && <p role="alert">{notice}</p>}
    <details onToggle={event => { if (event.currentTarget.open) void refresh(); }}>
      <summary>错误诊断</summary>
      <div className="pg-diagnostic-actions"><input aria-label="问题编号" placeholder="问题编号（留空查看最近记录）" value={id} onChange={e => setId(e.target.value)} /><Button size="sm" onClick={() => void refresh()}>查询</Button><Button size="sm" onClick={() => void window.playground.copyDiagnostics(id || undefined).then(() => setMessage('已复制诊断信息。')).catch(() => setMessage('复制失败，请先查询后复制展开的记录。'))}>复制诊断</Button></div>
      {message && <p role="status">{message}</p>}
      {data.storageError && <details><summary>诊断存储失败原因</summary><pre>{JSON.stringify(data.storageError, null, 2)}</pre></details>}
      {data.entries.map(entry => <details key={entry.correlationId}><summary>{entry.time} · {entry.gameId ?? '窗口/未归属游戏'} · {entry.stage} · {entry.correlationId}</summary><pre>{JSON.stringify(entry, null, 2)}</pre></details>)}
      {!data.entries.length && localDiagnostics().length > 0 && <details><summary>当前页面暂存记录</summary><pre>{JSON.stringify(localDiagnostics(), null, 2)}</pre></details>}
    </details>
  </aside>;
}
