import type { HandMove } from './expanded-poses';

export function MovementHands({ move, amount, phase }: { move: HandMove; amount: number; phase: number }) {
  const v = Math.abs(amount);
  const palmWidth = move === 'palmTurn' ? Math.max(.28, Math.abs(Math.cos(phase))) : 1;
  const rotation = move === 'wristSide' ? amount * 22 : move === 'wristAssist' ? amount * 28 : 0;
  const joint = move === 'prayer' ? 84 + 15 * v : 94;
  return <svg className="desk-movement-diagram" viewBox="0 0 220 150" aria-hidden="true">
    {move === 'prayer' ? <>
      <path d="M45 129h130" className="movement-ground" />
      <path d={`M60 127 L108 ${joint} L109 ${joint - 31} M160 127 L112 ${joint} L111 ${joint - 31}`} className="movement-person" />
    </> : <>
      <path d="M62 138 L99 94 M100 140 L116 94" className="movement-chair" />
      <g transform={`translate(108 94) rotate(${rotation}) scale(${palmWidth} 1)`}>
        <path d="M-9 1Q-14-10-13-23Q-7-31 7-27Q14-23 10 1" className="movement-person" />
        {[0, 1, 2, 3].map(index => {
          const x = -12 + index * 7;
          const spread = (index - 1.5) * 3 * (move === 'fingers' ? 1 - v : 1);
          const curl = move === 'fingers' ? v : 0;
          const length = 22 + (index === 1 ? 6 : 0);
          return <path key={index} d={`M${x} -24 q${spread} ${-length * (1 - curl / 2)} ${spread + 4 * curl} ${-length * (1 - curl)}`} className="movement-person" />;
        })}
        <path d="M-12-13l-14-10" className="movement-person" />
      </g>
      {move === 'wristAssist' && <path d={`M181 71q-21-6-39-7l${-24 + 9 * amount} ${-12 + 12 * v}`} className="movement-chair" />}
      {move === 'palmTurn' && <path d="M86 46q23-18 45 0m-8-1 8 1-3-7" className="movement-direction" />}
    </>}
  </svg>;
}
