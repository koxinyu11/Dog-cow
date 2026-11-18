import { useState } from 'react';
import { ArrowRight, Check, MapPin } from 'lucide-react';
import { cafeContent as content, STARTING_CAPITAL, item, SHIFTS } from '../../../../../shared/cafe/content';
import { setupQuote } from '../../../../../shared/cafe/commands';
import { yuan } from '../../../../../shared/cafe/finance';
import type { Setup as SetupValue } from '../../../../../shared/cafe/types';
import { CafeScene } from './Scene';
export function CafeSetup({ disabled, open }: { disabled: boolean; open(setup: SetupValue): void }) {
  const [setup, setSetup] = useState<SetupValue>({
    location: 'campus',
    machine: 'starter',
    seats: 6,
    positioning: 'express',
  });
  const location = item(content.locations, setup.location),
    quote = setupQuote(setup);
  return (
    <div className="cf-setup">
      <header className="cf-intro">
        <div>
          <span className="cf-eyebrow">一间小店 · 八周经营手记</span>
          <h1>在街角，开一家咖啡馆。</h1>
          <p>第一步，找到属于你的那条街。</p>
        </div>
        <div className="cf-start-fund">
          <span>启动资金</span>
          <strong>{yuan(STARTING_CAPITAL)}</strong>
        </div>
      </header>
      <div className="cf-sites">
        {content.locations.map((site, index) => (
          <button
            className="cf-site"
            key={site.id}
            aria-pressed={site.id === setup.location}
            disabled={disabled}
            onClick={() =>
              setSetup({ ...setup, location: site.id, seats: Math.min(setup.seats, site.maxSeats) })
            }
          >
            <div className="cf-site-art">
              <CafeScene color={site.color} seats={setup.seats} />
              <span className="cf-site-no">0{index + 1}</span>
              {site.id === setup.location && (
                <span className="cf-selected">
                  <Check size={16} />
                </span>
              )}
            </div>
            <div className="cf-site-body">
              <span className="cf-eyebrow">
                <MapPin size={12} />
                {site.district}
              </span>
              <h2>{site.name}</h2>
              <p>{site.description}</p>
              <div className="cf-site-numbers">
                <span>
                  <small>月租</small>
                  <b>{yuan(site.rent)}</b>
                </span>
                <span>
                  <small>面积</small>
                  <b>{site.area} m²</b>
                </span>
              </div>
              <div
                className="cf-footfall"
                aria-label={`早午晚每小时人流 ${SHIFTS.map((s) => site.footfall[s]).join('、')}`}
              >
                {SHIFTS.map((shift, i) => (
                  <span key={shift}>
                    <i style={{ height: `${site.footfall[shift] / 4}px` }} />
                    <small>{['早', '午', '晚'][i]}</small>
                  </span>
                ))}
                <em>人流 / 小时</em>
              </div>
              <div className="cf-site-tags">
                <span>周末 ×{site.weekend}</span>
                <span>竞品分流 {Math.round((1 - site.competition) * 100)}%</span>
              </div>
            </div>
          </button>
        ))}
      </div>
      <section className="cf-fitout">
        <div>
          <span className="cf-eyebrow">02 / 筹备小店</span>
          <h2>给第一天留足周转金</h2>
          <div className="cf-setup-fields">
            <label>
              店铺定位
              <select
                value={setup.positioning}
                disabled={disabled}
                onChange={(e) =>
                  setSetup({ ...setup, positioning: e.target.value as SetupValue['positioning'] })
                }
              >
                <option value="express">快取咖啡</option>
                <option value="cozy">社区休闲</option>
              </select>
            </label>
            <label>
              咖啡机
              <select
                value={setup.machine}
                disabled={disabled}
                onChange={(e) => setSetup({ ...setup, machine: e.target.value })}
              >
                {content.machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.cupsPerHour} 杯/时
                  </option>
                ))}
              </select>
            </label>
            <label>
              座位数 · 最多 {location.maxSeats} 席
              <input
                type="number"
                min="0"
                max={location.maxSeats}
                value={setup.seats}
                disabled={disabled}
                onChange={(e) =>
                  setSetup({
                    ...setup,
                    seats: Math.max(0, Math.min(location.maxSeats, Number(e.target.value) || 0)),
                  })
                }
              />
            </label>
          </div>
        </div>
        <div className="cf-quote">
          <dl>
            <div>
              <dt>押金 · {location.depositMonths} 个月</dt>
              <dd>{yuan(quote.deposit)}</dd>
            </div>
            <div>
              <dt>装修与座位</dt>
              <dd>{yuan(quote.fitout)}</dd>
            </div>
            <div>
              <dt>咖啡机</dt>
              <dd>{yuan(quote.machine)}</dd>
            </div>
            <div>
              <dt>首批原料</dt>
              <dd>{yuan(quote.inventory)}</dd>
            </div>
            <div className="cf-quote-total">
              <dt>剩余周转金</dt>
              <dd>{yuan(STARTING_CAPITAL - quote.total)}</dd>
            </div>
          </dl>
          <button
            className="cf-primary"
            disabled={disabled || quote.total > STARTING_CAPITAL}
            onClick={() => open(setup)}
          >
            签约，准备开店 <ArrowRight size={16} />
          </button>
          <small>签约即扣款，铺位不可更换。租金按周结算。</small>
        </div>
      </section>
      <details className="cf-help">
        <summary>了解客群与经营规则</summary>
        <p>
          写字楼顾客偏好快取，大学客群更在意价格，社区顾客更看重堂食。人流不等于订单，价格、品质、定位和口碑共同影响购买。所有金额为游戏内模拟人民币，与狗牛币独立。
        </p>
      </details>
    </div>
  );
}
