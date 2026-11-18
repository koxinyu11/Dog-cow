import { useId } from 'react';
/** Original lightweight artwork. Also reused as the game's lobby cover. */
export function CafeScene({
  color = '#78865e',
  compact = false,
  seats = 6,
}: {
  color?: string;
  compact?: boolean;
  seats?: number;
}) {
  const pattern = useId();
  return (
    <svg
      className={`cf-scene${compact ? ' is-compact' : ''}`}
      viewBox="0 0 720 300"
      role="img"
      aria-label="街角的狗牛咖啡馆"
    >
      <defs>
        <pattern id={pattern} width="36" height="28" patternUnits="userSpaceOnUse">
          <path d="M0 27H36M18 0V27" fill="none" stroke="#d1c4ad" strokeWidth="1" />
        </pattern>
      </defs>
      <path fill="#e8e0ce" d="M0 0H720V300H0z" />
      <path fill="#ddd3bb" d="M0 237H720V300H0z" />
      <path d="M0 267H720M0 290H720" stroke="#c8bba1" strokeWidth="1" />
      <rect x="138" y="38" width="444" height="204" fill="#f6f0dc" />
      <rect x="138" y="38" width="444" height="204" fill={`url(#${pattern})`} opacity=".5" />
      <rect x="151" y="76" width="418" height="153" fill="#544b3c" />
      <rect x="162" y="91" width="396" height="133" fill="#eadbb7" />
      <rect x="178" y="102" width="145" height="111" rx="3" fill="#d2b885" />
      <rect x="189" y="112" width="122" height="68" fill="#f5e7be" />
      <path d="M250 112V180M189 145H311" stroke="#bd9b65" strokeWidth="4" />
      <rect x="352" y="163" width="185" height="58" fill="#b07c50" />
      <path d="M346 163H545" stroke="#694e36" strokeWidth="8" />
      <rect x="460" y="127" width="58" height="32" rx="3" fill="#606c5c" />
      <rect x="468" y="133" width="40" height="12" rx="2" fill="#b8c5aa" />
      <path d="M472 150v9m29-9v9" stroke="#313e34" strokeWidth="3" />
      <g transform="translate(401 140)">
        <ellipse cy="2" rx="17" ry="16" fill="#eee6d2" />
        <path d="M-13-7l-9-11 1 16m34-5 9-11-1 16" fill="#b08d69" />
        <ellipse cx="-5" cy="0" rx="2" ry="3" fill="#493b30" />
        <ellipse cx="7" cy="0" rx="2" ry="3" fill="#493b30" />
        <ellipse cy="9" rx="8" ry="5" fill="#cda78b" />
      </g>
      <path d="M132 72H588L573 112H147z" fill={color} />
      {Array.from({ length: 12 }, (_, i) => (
        <path key={i} d={`M${137 + i * 38} 72h18l-2 40h-17z`} fill="#f8efd8" opacity=".8" />
      ))}
      <rect x="251" y="29" width="220" height="38" rx="3" fill={color} />
      <text
        x="361"
        y="54"
        textAnchor="middle"
        fill="#fff5df"
        fontFamily="Georgia, serif"
        fontSize="20"
        letterSpacing="3"
      >
        DOGCOW CAFÉ
      </text>
      <rect x="339" y="113" width="44" height="36" fill="#53604a" />
      <text x="361" y="127" textAnchor="middle" fill="#f1dfba" fontSize="7">
        TODAY'S
      </text>
      <text x="361" y="139" textAnchor="middle" fill="#f1dfba" fontSize="9">
        COFFEE
      </text>
      {seats > 0 && (
        <g>
          <ellipse cx="235" cy="218" rx="39" ry="9" fill="#9b704d" />
          <path d="M235 218V244m-24 0h48" stroke="#75563e" strokeWidth="5" />
          <path
            d="M181 211v31m13-24v24m-19-35h25m67 4v31m13-24v24m-20-35h25"
            stroke="#75805c"
            strokeWidth="6"
          />
        </g>
      )}
      <g fill="#71805d">
        <ellipse cx="104" cy="157" rx="26" ry="35" />
        <ellipse cx="88" cy="181" rx="20" ry="28" />
        <ellipse cx="117" cy="186" rx="21" ry="26" />
      </g>
      <path d="M104 178v53" stroke="#88694a" strokeWidth="6" />
      <path d="M81 223h47l-7 34H88z" fill="#ac785a" />
      <rect x="602" y="190" width="55" height="68" rx="3" fill="#8f6c4b" transform="rotate(6 630 220)" />
      <rect x="607" y="195" width="44" height="55" fill="#525d48" transform="rotate(6 630 220)" />
      <text x="630" y="218" fill="#f5e8ca" textAnchor="middle" fontSize="12">
        OPEN
      </text>
      <path d="M615 228h29m-26 7h21" stroke="#e8dab8" strokeWidth="2" />
      <path d="M0 36h88v192H0m643-199h77v197h-77" fill="#c4c6ad" opacity=".6" />
      <path d="M15 56h55v59H15m643-60h49v72h-49" fill="#a1ad94" />
    </svg>
  );
}
