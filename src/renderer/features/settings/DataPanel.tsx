import { useState } from 'react';
import { command } from '../../state';

export function DataPanel({ notify }: { notify: (message: string) => void }) {
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
      <button onClick={() => void command('checkUpdates').then((r) => notify(r.message))}>
        检查更新
      </button>
      <button onClick={() => void command('openSource')}>打开官方下载页</button>
      <p className="muted">
        当前构建未配置签名更新通道时使用手动下载安装。Windows 本轮按用户要求未验收。
      </p>
    </section>
  );
}
