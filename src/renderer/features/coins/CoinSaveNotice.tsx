import { useState } from 'react';
import type { CoinsView } from '../../../shared/coins';
import { command } from '../../state';
import { Button } from '../../ui';

/** Shared by the exchange dialog and appearance picker; retries disk persistence only. */
export function CoinSaveNotice({ coins }: { coins?: CoinsView }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!coins?.pendingSave) return null;
  return <div className="banner is-error" role="alert">
    <span>{error || '钱包修改尚未保存，请保留窗口并重试。'}</span>
    <Button size="sm" disabled={busy} onClick={async () => {
      setBusy(true); setError('');
      try {
        const result = await command('retrySave');
        if (!result.persisted) setError(result.message);
      } catch { setError('重试保存未完成，请保留窗口后再试。'); }
      finally { setBusy(false); }
    }}>重试保存</Button>
  </div>;
}
