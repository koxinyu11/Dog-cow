import { useState } from 'react';
export interface TrayFeedbackProps {
  message: string;
  code?: string;
  correlationId?: string;
  busy: boolean;
  onRetry(): void;
  onCopy(): Promise<unknown>;
}
/** Only rendered for actionable failure; diagnostics remain collapsed. */
export function TrayFeedback({ message, code, correlationId, busy, onRetry, onCopy }: TrayFeedbackProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  return <div className="tray-error-feedback" role="status">
    <div className="tray-error-line"><span>{message}</span><button type="button" disabled={busy} onClick={onRetry}>重试</button></div>
    <details><summary>详情</summary><p>{code || '设置未保存'}{correlationId ? ` · ${correlationId}` : ''}</p>
      <button type="button" onClick={() => { void onCopy().then(() => { setCopied(true); setCopyFailed(false); }).catch(() => { setCopyFailed(true); setCopied(false); }); }}>
        {copyFailed ? '复制失败，再试一次' : copied ? '已复制' : '复制诊断信息'}
      </button>
    </details>
  </div>;
}
