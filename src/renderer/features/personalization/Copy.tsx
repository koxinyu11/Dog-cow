import { useRef, useState } from 'react';

export function Copy({
  value,
  name,
  commit,
}: {
  value: string;
  name: string;
  commit: (key: string, value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const cancel = useRef(false);
  if (editing)
    return (
      <input
        autoFocus
        aria-label={`编辑${name}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            cancel.current = true;
            setEditing(false);
          }
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        onBlur={() => {
          if (!cancel.current) commit(name, draft);
          cancel.current = false;
          setEditing(false);
        }}
      />
    );
  return (
    <span
      className="copy-edit"
      tabIndex={0}
      title="点击修改"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          setDraft(value);
          setEditing(true);
        }
      }}
    >
      {value || '点击设置文字'}
    </span>
  );
}
