import { Field } from './Modal';

export function NumberField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: number | string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const unit = label.endsWith('（元）') ? '元' : label.endsWith('（%）') ? '%' : '';
  return (
    <Field label={unit ? label.slice(0, -3) : label} error={error}>
      <NumberInput value={value} onChange={onChange} unit={unit} />
    </Field>
  );
}

function NumberInput({ value, onChange, unit, ...props }: {
  value: number | string;
  onChange: (value: string) => void;
  unit: string;
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}) {
  return <span className="number-control">
    <input {...props} type="number" step="any" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    {unit && <span className="field-unit" aria-hidden="true">{unit}</span>}
  </span>;
}
