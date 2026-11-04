import { Field } from './Modal';

export function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <input type="number" step="any" value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}
