import { useEffect, useRef, useState } from 'react';
import { DraftSession } from '../../shared/draft-session';
import { type Result } from '../../shared/contracts';
import { registerFlush } from '../state';

export function useAutoDraft<T>(
  value: T,
  submit: (draft: T) => Promise<Result>,
  validate: (draft: T) => Record<string, string>,
  enabled = true,
  identity = '',
) {
  const session = useRef(new DraftSession(value)).current;
  const [draft, setDraft] = useState(session.value);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState('填写后自动保存。');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const submitRef = useRef(submit);
  submitRef.current = submit;
  const validRef = useRef(validate);
  validRef.current = validate;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const signature = JSON.stringify(value);
  useEffect(() => {
    if (session.restore(value)) setDraft(session.value);
  }, [signature]);
  useEffect(() => {
    clearTimeout(timer.current);
    session.reset(value);
    setDraft(session.value);
    setErrors({});
    setFeedback('填写后自动保存。');
  }, [identity]);
  const flush = async () => {
    clearTimeout(timer.current);
    if (!enabledRef.current) return true;
    if (session.dirty) setFeedback('保存中…');
    return session.flush(
      (candidate) => submitRef.current(candidate),
      (candidate) => validRef.current(candidate),
      (result) => {
        setFeedback(result.message);
        setErrors(result.errors || {});
      },
    );
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    const unregister = registerFlush(() => flushRef.current());
    return () => {
      unregister();
      clearTimeout(timer.current);
      void flushRef.current();
    };
  }, []);
  const change = (next: T) => {
    session.edit(next);
    setDraft(session.value);
    clearTimeout(timer.current);
    if (enabledRef.current) timer.current = setTimeout(() => void flushRef.current(), 250);
  };
  return { draft, change, errors, feedback, flush };
}
