import { useState } from 'react';

export function Copy({ value, name, commit, fallback = '', label = '标题' }: {
  value: string;
  name: string;
  commit: (key: string, value: string) => void;
  fallback?: string;
  label?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const finish = () => {
    commit(name, draft.trim());
    setEditing(false);
  };
  if (editing) return (
    <input
      autoFocus
      aria-label={`编辑${label}`}
      value={draft}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          setEditing(false);
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      onBlur={finish}
    />
  );
  return (
    <span className="copy-edit">
      <span>{value || fallback || '点击设置文字'}</span>
      <button type="button" className="copy-edit-trigger" aria-label={`修改${label}`} title={`修改${label}`}
        onClick={(event) => {
          event.stopPropagation();
          setDraft(value);
          setEditing(true);
        }}>✎</button>
    </span>
  );
}
