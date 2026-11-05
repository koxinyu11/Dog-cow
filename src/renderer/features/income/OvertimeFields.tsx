import { HandCoins } from 'lucide-react';
import { DEFAULT_OVERTIME_CONFIG } from '../../../../app/income/src/owed.js';
import type { IncomeSettings, OvertimeConfig } from '../../../shared/contracts';
import { NumberField } from '../../components/NumberField';
import { Switch } from '../../ui';

export function OvertimeFields({ settings, error, change }: { settings: IncomeSettings; error?: string; change: (value: OvertimeConfig) => void }) {
  const value = settings.overtime ?? { ...DEFAULT_OVERTIME_CONFIG };
  const set = (key: keyof OvertimeConfig, next: unknown) => change({ ...value, [key]: next });
  return (
    <section className="setting-group">
      <h3><HandCoins size={16} /> 老板欠我钱</h3>
      <Switch checked={value.enabled} label="公司付加班费" hint={value.enabled ? '按应付加班费显示' : '按精神欠款显示'}
        onChange={(on) => set('enabled', on)} />
      <div className="settings-pair">
        <NumberField label="工作日倍率" value={value.workdayRate} onChange={(v) => set('workdayRate', v)} />
        <NumberField label="休息日倍率" value={value.restRate} onChange={(v) => set('restRate', v)} />
      </div>
      <div className="settings-pair">
        <NumberField label="节假日倍率" value={value.holidayRate} onChange={(v) => set('holidayRate', v)} />
        <NumberField label="起算分钟" value={value.minMinutes} onChange={(v) => set('minMinutes', v)} error={error} />
      </div>
    </section>
  );
}
