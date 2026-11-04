import { useEffect, useRef, useState } from 'react';

export function AutoText({
  value,
  onCommit,
  area = false,
  label,
}: {
  value: string;
  onCommit: (value: string) => Promise<void>;
  area?: boolean;
  label: string;
}) {
  const [draft, set] = useState(value);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(draft);
  const generation = useRef(0);
  const saveRef = useRef(onCommit);
  saveRef.current = onCommit;
  useEffect(() => {
    if (!dirty.current) {
      set(value);
      latest.current = value;
    }
  }, [value]);
  const save = async () => {
    clearTimeout(timer.current);
    if (!dirty.current) return;
    const gen = generation.current;
    await saveRef.current(latest.current);
    if (gen === generation.current) dirty.current = false;
  };
  useEffect(() => {
    const flush = () => void save();
    window.addEventListener('dogcow:flush', flush);
    return () => {
      clearTimeout(timer.current);
      window.removeEventListener('dogcow:flush', flush);
      void save();
    };
  }, []);
  const props = {
    value: draft,
    'aria-label': label,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      latest.current = event.target.value;
      set(latest.current);
      generation.current++;
      dirty.current = true;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(), 250);
    },
    onBlur: () => void save(),
  };
  return area ? <textarea {...props} /> : <input className="title-input" {...props} />;
}
