import { useState, type CSSProperties } from 'react';

export function Confetti() {
  const [pieces] = useState(() =>
    Array.from(
      { length: 90 },
      (_, i) =>
        ({
          left: `${Math.random() * 100}%`,
          background: ['#255c48', '#db6d3a', '#f4c95d', '#e76f8a', '#6c8cff', '#9b5de5'][i % 6],
          '--duration': `${2.2 + Math.random() * 1.8}s`,
          '--drift': `${-120 + Math.random() * 240}px`,
          '--rotation': `${Math.random() * 360}deg`,
          animationDelay: `${Math.random() * 0.45}s`,
        }) as CSSProperties,
    ),
  );
  return (
    <div className="confetti-layer" aria-hidden="true" data-confetti>
      {pieces.map((style, i) => (
        <span className="confetti" key={i} style={style} />
      ))}
    </div>
  );
}
