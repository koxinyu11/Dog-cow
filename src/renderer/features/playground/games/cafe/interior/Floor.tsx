import { useId } from 'react';
import { tablePosition, seatPosition } from './layout';
export function Floor({ seats, color, running }: { seats: number; color: string; running: boolean }) {
  const id = useId();
  return (
    <>
      <defs>
        <pattern id={`${id}-floor`} width="66" height="28" patternUnits="userSpaceOnUse">
          <rect width="66" height="28" fill="#d9c5a2" />
          <path d="M0 27h66M33 0v27" stroke="#c9b28d" strokeWidth="1" />
          <path d="M5 7h20m19 12h17" stroke="#cfb993" strokeWidth=".6" />
        </pattern>
        <filter id={`${id}-shadow`} x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#6e5c40" floodOpacity=".13" />
        </filter>
      </defs>
      <rect width="1000" height="660" fill="#ece4d2" />
      <path d="M0 614h1000m-1000 22h1000" stroke="#ddd1b9" />
      <path d="M64 74h872v494H64z" fill={`url(#${id}-floor)`} />
      <path d="M64 74h872v35H64z" fill="#c4bda7" />
      <path d="M64 74v494h375m87 0h410V74" fill="none" stroke="#faf4e6" strokeWidth="22" />
      <path d="M64 74h872" stroke="#9e9f85" strokeWidth="10" />
      <path d="M65 95v454m870-454v454" stroke="#b7b395" strokeWidth="7" />
      <rect x="111" y="69" width="205" height="29" rx="2" fill="#dfe8d5" stroke="#89987b" strokeWidth="5" />
      <path d="M180 69v29m67-29v29" stroke="#89987b" strokeWidth="4" />
      <rect x="373" y="69" width="202" height="29" rx="2" fill="#dfe8d5" stroke="#89987b" strokeWidth="5" />
      <path d="M442 69v29m67-29v29" stroke="#89987b" strokeWidth="4" />
      <text
        x="345"
        y="139"
        textAnchor="middle"
        fill="#9a8b6f"
        fontFamily="Georgia,serif"
        fontSize="12"
        letterSpacing="4"
      >
        A LITTLE COFFEE, A GOOD DAY.
      </text>
      <rect x="686" y="112" width="211" height="348" rx="5" fill="#bbc1a6" />
      <rect x="706" y="125" width="171" height="318" rx="4" fill="#cdd0b7" />
      <path d="M665 137v271h207" fill="none" stroke="#947551" strokeWidth="34" strokeLinejoin="round" />
      <path d="M661 134v268h211" fill="none" stroke="#bd9b6d" strokeWidth="26" strokeLinejoin="round" />
      <rect x="748" y="143" width="100" height="57" rx="5" fill="#63715d" filter={`url(#${id}-shadow)`} />
      <rect x="757" y="152" width="81" height="18" rx="2" fill="#afbfa1" />
      <circle cx="820" cy="161" r="3" fill={running ? '#e8d695' : '#7f8e77'} />
      <path d="M773 181v12m41-12v12" stroke="#3e4e3b" strokeWidth="4" />
      <path d="M765 198h18m22 0h18" stroke="#f4edda" strokeWidth="4" />
      <rect x="690" y="327" width="41" height="34" rx="4" fill="#ede5d1" />
      <path d="M696 335h27m-27 7h18" stroke="#8d9a7c" strokeWidth="3" />
      <rect x="659" y="215" width="20" height="48" rx="2" fill="#e6d4af" />
      <text x="654" y="241" textAnchor="end" fill="#80755c" fontSize="9">
        取餐
      </text>
      <rect x="654" y="290" width="22" height="29" rx="2" fill="#627158" />
      <text x="651" y="308" textAnchor="end" fill="#80755c" fontSize="9">
        点单
      </text>
      {Array.from({ length: Math.ceil(seats / 2) }, (_, table) => {
        const p = tablePosition(table);
        return (
          <g key={table} filter={`url(#${id}-shadow)`}>
            {[table * 2, table * 2 + 1]
              .filter((s) => s < seats)
              .map((s) => {
                const seat = seatPosition(s);
                return (
                  <g key={s}>
                    <rect x={seat.x - 13} y={seat.y - 9} width="26" height="29" rx="7" fill="#7e8c69" />
                    <path
                      d={`M${seat.x - 12} ${seat.y + (s % 2 ? 19 : -8)}h24`}
                      stroke="#657452"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  </g>
                );
              })}
            <ellipse cx={p.x} cy={p.y + 8} rx="24" ry="28" fill="#a88458" />
            <ellipse cx={p.x} cy={p.y} rx="28" ry="29" fill="#e9d8ae" />
            <ellipse cx={p.x} cy={p.y} rx="24" ry="25" fill="none" stroke="#d4bd8f" />
            <rect x={p.x - 5} y={p.y - 11} width="10" height="12" rx="2" fill="#a5ad86" />
            <path d={`M${p.x} ${p.y - 10}v-9m-3 4 3 3 4-5`} stroke="#7b8d61" strokeWidth="2" fill="none" />
          </g>
        );
      })}
      {seats === 0 && (
        <text x="333" y="305" textAnchor="middle" fontSize="15" fill="#a39070">
          快取小店 · 暂无堂食座位
        </text>
      )}
      <path d="M438 571h88v19h-88z" fill="#92a181" />
      <path d="M441 592h80" stroke="#b7a887" strokeWidth="2" />
      <text x="482" y="614" textAnchor="middle" fill="#8f856e" fontSize="10" letterSpacing="3">
        WELCOME
      </text>
      <g transform="translate(112 497)">
        <ellipse rx="19" ry="14" fill="#987957" />
        <path d="M0-2v-26m0 15-12-13m12 7 10-15" stroke="#667d4f" strokeWidth="4" />
        <ellipse cx="-9" cy="-29" rx="10" ry="7" fill="#829567" />
        <ellipse cx="9" cy="-39" rx="11" ry="8" fill="#71885b" />
        <ellipse cy="-41" rx="8" ry="13" fill="#92a274" />
      </g>
      <g transform="translate(846 505)">
        <rect x="-27" y="-16" width="54" height="38" rx="3" fill={color} />
        <text y="0" textAnchor="middle" fill="#f5edd5" fontSize="9">
          DOGCOW
        </text>
        <text y="13" textAnchor="middle" fill="#f5edd5" fontSize="9">
          CAFÉ
        </text>
      </g>
      <text x="797" y="119" textAnchor="middle" fill="#6c795e" fontSize="10" letterSpacing="2">
        COFFEE BAR
      </text>
    </>
  );
}
