// Background scenes. The same markup renders the full-window background and the small
// swatch in 设置 → 外观; sizes use container units so both scale from one definition.
import type { CSSProperties, ReactNode } from 'react';
import type { PresetKey } from '../../shared/board';

const layers: Partial<Record<PresetKey, ReactNode>> = {
  meadow: (
    <>
      <i className="sc-sun" />
      <i className="sc-cloud c1" />
      <i className="sc-cloud c2" />
      <i className="sc-hill h1" />
      <i className="sc-hill h2" />
      <i className="sc-walker">
        <span>🐄</span>
      </i>
      <i className="sc-hill h3" />
      <i className="sc-grass" />
      <i className="sc-flowers">
        <span>🌼</span>
        <span>🌸</span>
        <span>🌼</span>
      </i>
    </>
  ),
  ocean: (
    <>
      <i className="sc-sun" />
      <i className="sc-sea" />
      <i className="sc-wave w1" />
      <i className="sc-fish f1">
        <span>🐟</span>
      </i>
      <i className="sc-wave w2" />
      <i className="sc-fish f2">
        <span>🐠</span>
      </i>
      <i className="sc-bubbles">
        <span />
        <span />
        <span />
      </i>
      <i className="sc-wave w3" />
    </>
  ),
  sunset: (
    <>
      <i className="sc-sun" />
      <i className="sc-cloud c1" />
      <i className="sc-cloud c2" />
      <i className="sc-skyline" />
    </>
  ),
  night: (
    <>
      <i className="sc-stars s1" />
      <i className="sc-stars s2" />
      <i className="sc-moon" />
      <i className="sc-shoot" />
      <i className="sc-skyline" />
    </>
  ),
  friday: (
    <>
      <i className="sc-blob b1" />
      <i className="sc-blob b2" />
      <i className="sc-blob b3" />
      <i className="sc-blob b4" />
    </>
  ),
  monday: (
    <>
      <i className="sc-cloud c1" />
      <i className="sc-cloud c2" />
      <i className="sc-cloud c3" />
    </>
  ),
  boba: <i className="sc-pearls" />,
  pie: (
    <i className="sc-pies">
      {['8% 18%', '78% 12%', '30% 70%', '88% 64%', '55% 34%'].map((at, i) => (
        <span key={i} style={{ left: at.split(' ')[0], top: at.split(' ')[1] } as CSSProperties}>
          🥧
        </span>
      ))}
    </i>
  ),
  candy: (
    <>
      <i className="sc-cloud c1" />
      <i className="sc-cloud c2" />
    </>
  ),
};

export function Scene({ preset }: { preset: PresetKey }) {
  return (
    <span className={`scene sc-${preset}`} aria-hidden="true">
      {layers[preset]}
    </span>
  );
}
