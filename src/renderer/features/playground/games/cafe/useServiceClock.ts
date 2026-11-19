import { useCallback, useEffect, useRef, useState } from 'react';
import type { CafeAction } from '../../../../../shared/cafe/types';
import type { ServiceRun, ServiceTimeline } from '../../../../../shared/cafe/service';
interface Options {
  run?: ServiceRun;
  timeline?: ServiceTimeline;
  paused: boolean;
  blocked: boolean;
  send(action: CafeAction): Promise<boolean>;
  finished(): void;
}
/** Playback only advances a persisted run cursor; finances remain authoritative in the domain. */
export function useServiceClock(options: Options) {
  const latest = useRef(options);
  latest.current = options;
  const [cursor, setCursor] = useState(options.run?.cursor ?? 0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const position = useRef(cursor),
    moving = useRef(playing),
    rate = useRef(speed);
  const finishing = useRef(false),
    checkpoint = useRef(false),
    lastSaved = useRef(0);
  moving.current = playing;
  rate.current = speed;
  useEffect(() => {
    position.current = latest.current.run?.cursor ?? 0;
    setCursor(position.current);
    setPlaying(true);
    finishing.current = false;
    lastSaved.current = 0;
  }, [options.run?.id]);
  useEffect(() => {
    if (options.run && options.run.cursor > position.current) {
      position.current = options.run.cursor;
      setCursor(position.current);
    }
  }, [options.run?.cursor]);
  const save = useCallback(async () => {
    const { run, send, blocked } = latest.current;
    const next = Math.floor(position.current);
    if (!run || blocked || checkpoint.current || finishing.current || next <= run.cursor) return;
    checkpoint.current = true;
    try {
      await send({ action: 'advance', runId: run.id, cursor: next });
    } finally {
      checkpoint.current = false;
    }
  }, []);
  const finish = useCallback(async () => {
    const { run, send, blocked, finished } = latest.current;
    if (!run || blocked || finishing.current || checkpoint.current) return;
    finishing.current = true;
    setPlaying(false);
    try {
      if (await send({ action: 'finish', runId: run.id })) finished();
    } finally {
      finishing.current = false;
    }
  }, []);
  useEffect(() => {
    let frame = 0,
      previous = performance.now(),
      painted = 0;
    const tick = (now: number) => {
      const { run, timeline, paused, blocked } = latest.current;
      const elapsed = Math.min(200, now - previous);
      previous = now;
      if (run && timeline && moving.current && !paused && !blocked && !finishing.current) {
        position.current = Math.min(
          timeline.duration,
          position.current + (elapsed / 1000) * 6 * rate.current,
        );
        if (now - painted > 50) {
          setCursor(position.current);
          painted = now;
        }
        if (position.current >= timeline.duration) void finish();
        else if (now - lastSaved.current > 3000) {
          lastSaved.current = now;
          void save();
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      void save();
    };
  }, [finish, save]);
  useEffect(() => {
    if (options.paused || !playing) void save();
  }, [options.paused, playing, save]);
  return {
    cursor,
    playing: playing && !options.paused && !options.blocked,
    locallyPlaying: playing,
    speed,
    setSpeed,
    toggle: () => setPlaying((value) => !value),
    finish,
  };
}
