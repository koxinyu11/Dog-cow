import { setSelfDeception, useDisplayIncome } from '../display-income';
import { coinWallpaper, isWallpaperUnlocked } from '../../shared/wallpapers';
import type { CoinsView } from '../../shared/coins';
import { CoinSwatch } from '../features/coins/CoinSwatch';
import { defaultFun, type FunState } from '../../shared/fun';
import { useRef, useState, type CSSProperties } from 'react';
import { ANIMATED_PRESETS, BACKGROUND_PRESETS, DARK_PRESETS, MAX_IMAGE_LENGTH, type Background, type PresetKey } from '../../shared/board';
import { isDark } from './Board';
import { Scene } from './Scene';
import { fx, setFxEnabled } from '../motion/fx';
import { Brush, ImagePlus, LayoutGrid, Palette, RotateCcw, Sparkles } from 'lucide-react';
import { setThemeMode, useTheme, type ThemeMode } from '../theme';
import { Button, Segmented, Switch } from '../ui';

export const FX_PREF_KEY = 'dogcow.ui.fx';

/** Whether header text should be light on this background. Images get a dark scrim, so they count as dark. */
export function backgroundIsDark(bg: Background) {
  if (bg.kind === 'preset') return DARK_PRESETS.includes(bg.value);
  if (bg.kind === 'color') return isDark(bg.value);
  return true;
}

export function backgroundStyle(bg: Background): { className: string; style?: CSSProperties } {
  if (bg.kind === 'preset') return { className: `bg-preset` };
  if (bg.kind === 'color') return { className: 'bg-color', style: { '--bg-color': bg.value } as CSSProperties };
  return { className: 'bg-image', style: { backgroundImage: `url("${bg.value}")` } };
}

/** Downscale a user image to at most 1920px on the long side, JPEG-encoded, so the board file stays small. */
async function encode(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.85, 0.7, 0.55, 0.4]) {
    const url = canvas.toDataURL('image/jpeg', quality);
    if (url.length <= MAX_IMAGE_LENGTH) return url;
  }
  throw Error('图片太大了，请换一张小一点的。');
}

export function Appearance({
  background,
  fun,
  titleIds,
  coins,
  setBackground,
  resetBoard,
  notify,
}: {
  background: Background;
  fun?: FunState;
  titleIds: readonly string[];
  coins?: CoinsView;
  setBackground: (bg: Background) => Promise<void>;
  resetBoard: () => void;
  notify: (message: string) => void;
}) {
  const { mode, resolved } = useTheme();
  const displayIncome = useDisplayIncome();
  const [motion, setMotion] = useState(() => localStorage.getItem(FX_PREF_KEY) !== 'off');
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const choose = async (bg: Background, anchor?: Element | null) => {
    await setBackground(bg);
    fx('background', anchor);
  };
  return (
    <div className="appearance">
      <section>
        <h3><Palette size={16} /> 显示模式</h3>
        <Segmented<ThemeMode>
          label="显示模式"
          value={mode}
          options={[[ 'light', '浅色' ], [ 'dark', '暗黑' ], [ 'auto', '自动' ]]}
          onChange={(next) => {
            if (!setThemeMode(next)) notify('显示模式未保存，本次仍然生效；下次启动可能跟随系统。');
          }}
        />
        <p className="muted" role="status">{mode === 'auto' ? '跟随系统外观 · ' : ''}当前为{resolved === 'dark' ? '暗黑' : '浅色'}模式</p>
      </section>
      <section>
        <h3><Sparkles size={16} /> 自欺欺人</h3>
        <Switch label="自欺欺人" checked={displayIncome.enabled}
          hint="主页收入金额 ×10，实际记录不变"
          onChange={(on) => {
            if (!setSelfDeception(on)) notify('自欺欺人设置未保存，请重试。');
          }} />
      </section>
      <section>
        <h3><Palette size={16} /> 背景</h3>
        <div className="bg-grid">
          {(Object.keys(BACKGROUND_PRESETS) as PresetKey[]).filter(key=>coinWallpaper(key) || isWallpaperUnlocked(key, fun ?? defaultFun(), titleIds, coins?.owned)).map((key) => !isWallpaperUnlocked(key, fun ?? defaultFun(), titleIds, coins?.owned) ? (
            <CoinSwatch key={key} preset={key} coins={coins} notify={notify} onBought={(anchor) => void choose({ kind: 'preset', value: key }, anchor)} />
          ) : (
            <button
              key={key}
              className={`bg-swatch ${DARK_PRESETS.includes(key) ? 'is-dark' : ''}`}
              aria-pressed={background.kind === 'preset' && background.value === key}
              onClick={(e) => void choose({ kind: 'preset', value: key }, e.currentTarget)}
            >
              <Scene preset={key} />
              <span className="bg-swatch-label">
                <span className="bg-swatch-name">{BACKGROUND_PRESETS[key]}</span>
                {ANIMATED_PRESETS.includes(key) && <Sparkles size={11} aria-label="会动" />}
              </span>
            </button>
          ))}
          <label
            className="bg-swatch bg-color"
            style={{ '--bg-color': background.kind === 'color' ? background.value : '#f1e6d2' } as CSSProperties}
            aria-pressed={background.kind === 'color'}
          >
            <input
              type="color"
              aria-label="自选纯色背景"
              value={background.kind === 'color' ? background.value : '#f1e6d2'}
              onChange={(e) => void choose({ kind: 'color', value: e.target.value }, e.currentTarget.parentElement)}
            />
            <span className="bg-swatch-label"><Brush size={12} /> 自选颜色</span>
          </label>
          <button
            className="bg-swatch bg-upload"
            aria-pressed={background.kind === 'image'}
            style={background.kind === 'image' ? { backgroundImage: `url("${background.value}")` } : undefined}
            disabled={busy}
            onClick={() => file.current?.click()}
          >
            <span className="bg-swatch-label">{busy ? '处理中…' : <><ImagePlus size={12} /> 上传图片</>}</span>
          </button>
        </div>
        <input
          ref={file}
          hidden
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={async (e) => {
            const picked = e.target.files?.[0];
            e.target.value = '';
            if (!picked) return;
            setBusy(true);
            try {
              await choose({ kind: 'image', value: await encode(picked) }, file.current?.previousElementSibling);
            } catch (error) {
              notify(error instanceof Error ? error.message : '图片读取失败。');
            } finally {
              setBusy(false);
            }
          }}
        />
        <p className="muted">带 ✦ 的背景会慢慢动，关掉下方「庆祝动效」后停住。图片只保存在本机，会被压缩到 1920 像素以内。</p>
      </section>
      <section>
        <h3><Sparkles size={16} /> 动效</h3>
        <Switch
          checked={motion}
         
         
          label="庆祝动效"
          hint="完成任务、打卡等时刻的小动画；系统开启「减少动态效果」时始终关闭"
          onChange={(on) => {
            setMotion(on);
            setFxEnabled(on);
            localStorage.setItem(FX_PREF_KEY, on ? 'on' : 'off');
            document.documentElement.classList.toggle('no-fx', !on);
          }}
        />
      </section>
      <section>
        <h3><LayoutGrid size={16} /> 主屏</h3>
        <p className="muted">一行可放 4 张小卡、3 张中卡或 2 张大卡；窗口很窄时减半。</p>
        <p className="muted">默认展示全部九张卡片：收入、倒计时、打卡、本周概览、完成度、下一项任务、偷出金额、任务列表和月历。可移除不需要的卡片；恢复时保留背景、卡片颜色与标题数据绑定。</p>
        <Button variant="ghost" icon={<RotateCcw size={15} />} onClick={resetBoard}>恢复默认模块</Button>
      </section>
    </div>
  );
}
