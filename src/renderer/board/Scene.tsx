// Background scenes. The same markup renders the full-window background and the small
// swatch in 设置 → 外观; sizes use container units so both scale from one definition.
import type { CSSProperties, ReactNode } from 'react';
import type { PresetKey } from '../../shared/board';

const layers: Partial<Record<PresetKey, ReactNode>> = {
  'cloud-rest': <><i className="sc-sun" /><i className="sc-cloud c1" /><i className="sc-cloud c2" /><i className="reward-float">🐮 ☁️</i><i className="reward-caption">今天也轻一点</i></>,
  'deep-rest': <><i className="reward-rays" /><i className="reward-bubbles">◦ ˚ ◦ ˚ ◦</i><i className="reward-jelly j1">🪼</i><i className="reward-jelly j2">🪼</i><i className="reward-seabed" /></>,
  'galaxy-off': <><i className="reward-stars" /><i className="reward-orbit" /><i className="reward-planet">🪐</i><i className="reward-ship">🐮 🚀</i></>,
  'money-rain': <><i className="wp-rain r1">💰 🪙 💴 🪙 💰</i><i className="wp-rain r2">🪙 💴 💰 💴 🪙</i><i className="wp-rain r3">💴 💰 🪙 💰 💴</i><i className="wp-catcher">🐮</i><i className="wp-caption">工资在路上</i></>,
  'milk-tea': <><i className="wp-pearls p1">● ● ●</i><i className="wp-pearls p2">● ● ●</i><i className="wp-pearls p3">● ●</i><i className="wp-cup">🧋</i><i className="wp-caption">少糖 · 去冰 · 自由</i></>,
  'pi-vault': <><i className="wp-digits">3.14159265358979323846264338327950288419716939937510582097494459</i><i className="wp-safe">🔐</i><i className="wp-caption">金额非常圆，非常无理</i></>,
  'run-offwork': <><i className="wp-clock">🕕</i><i className="wp-door">🚪</i><i className="wp-runner">🐮💨</i><i className="wp-floor" /></>,
  'friday-resident': <><i className="reward-stars" /><i className="wp-firework f1">🎆</i><i className="wp-firework f2">🎇</i><i className="wp-beer">🍻</i><i className="wp-caption">本牛常住周五</i></>,
  'monday-immune': <><i className="wp-calendar">MON</i><i className="wp-stamp">已免疫</i><i className="wp-mask">😷</i></>,
  'ticket-shredder': <><i className="wp-scrap s1">📄</i><i className="wp-scrap s2">🧾</i><i className="wp-scrap s3">📄</i><i className="wp-shredder">🗂️</i><i className="wp-caption">需求已粉碎</i></>,
  'overtime-hunter': <><i className="wp-sign">按时结账</i><i className="wp-holder">🐮</i><i className="wp-caption">加班费一分不少</i></>,
  'forever-shareholder': <><i className="wp-chart" /><i className="wp-rocket">📈</i><i className="wp-holder gold">🐮</i><i className="wp-caption">持股 365 天</i></>,
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
