import { useState } from 'react';
import { command, flushDrafts, useAppState } from '../../state';
import { Button } from '../../ui';

export function DataPanel({ notify }: { notify: (message: string) => void }) {
  const update = useAppState()?.updates;
  const busy = update?.status === 'checking' || update?.status === 'downloading';
  const [preview, setPreview] = useState<{
    token: string;
    message: string;
  } | null>(null);
  return (
    <section>
      <h3>数据迁移与备份</h3>
      <p>从原来使用的旧版导出迁移包，再在这里选择。旧 App、浏览器预览和新版的数据不会自动互通。</p>
      <div className="actions">
        <button onClick={() => void command('exportBackup').then((r) => notify(r.message))}>
          导出当前备份
        </button>
        <button
          onClick={() =>
            void command('chooseImport').then((r) => {
              notify(r.message);
              setPreview(r.code ? { token: r.code, message: r.message } : null);
            })
          }
        >
          选择迁移包
        </button>
      </div>
      {preview && (
        <div className="notice">
          <p>{preview.message}</p>
          <button
            onClick={() =>
              void command('commitImport', { token: preview.token }).then((r) => {
                notify(r.message);
                if (r.applied) setPreview(null);
              })
            }
          >
            备份并确认导入
          </button>
          <button onClick={() => setPreview(null)}>取消预览</button>
        </div>
      )}
      <h3>版本与更新</h3>
      <p role="status">{update?.version ? `v${update.version} · ` : ''}{update?.message || '自动检查并下载最新正式版，安装需手动完成。'}</p>
      {update?.status === 'downloading' && <progress aria-label="更新下载进度" max={100} value={update.progress}>{update.progress}%</progress>}
      <div className="actions">
        <Button disabled={busy} onClick={() => void command('checkUpdates').then((r) => notify(r.message))}>{busy ? '正在处理…' : update?.status === 'error' ? '重试更新' : '检查更新'}</Button>
        {update?.status === 'ready' && <Button variant="primary" onClick={() => void flushDrafts().then((ok) => ok ? command('openUpdate').then((r) => notify(r.message)) : notify('请先完成并保存当前输入。'))}>打开安装包</Button>}
        <Button variant="ghost" onClick={() => void command('openSource')}>官方下载页</Button>
      </div>
    </section>
  );
}
