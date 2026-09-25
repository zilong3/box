import type { KeyboardEvent, ReactNode } from 'react';

import { useDrawer } from '@/state/drawer';
import {
  transitionLabel,
  uptimeLabel,
  useService,
  type ServiceSnapshot,
} from '@/state/service';

import styles from './index.module.less';

/** 运行中：绿色圆环 + 对勾 */
function RunningArt() {
  return (
    <svg className={styles.art} viewBox="0 0 120 120" aria-hidden="true">
      <path
        d="M60 12a48 48 0 1 0 48 48"
        fill="none"
        stroke="#22c55e"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path
        d="M40 62l16 16 30-34"
        fill="none"
        stroke="#22c55e"
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 已停止：灰色圆环 + 一横 */
function StoppedArt() {
  return (
    <svg className={styles.art} viewBox="0 0 120 120" aria-hidden="true">
      <path
        d="M60 12a48 48 0 1 0 48 48"
        fill="none"
        stroke="#9a9aa0"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <rect x="38" y="55" width="44" height="11" rx="5.5" fill="#9a9aa0" />
    </svg>
  );
}

/** 过渡态：底部一条流动的进度条 */
function TransitionBar() {
  return (
    <div className={styles.progress}>
      <span className={styles.progressInner} />
    </div>
  );
}

/** 过渡态在核心名前面显示的小转圈 */
function Spinner() {
  return (
    <svg className={styles.spinner} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
      <path d="M10 2.5a7.5 7.5 0 0 1 7.5 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 首页顶部状态横幅。
 *
 * 四种状态各有配色与插画：
 * - running  绿色，绿色对勾圆环
 * - stopped  灰色，灰色横杠圆环
 * - starting / stopping  琥珀色，转圈 + 进度条
 *
 * 只有"已停止"时可以点击整条横幅打开基础代理配置抽屉：
 * 服务停着的时候用户多半是要去改配置，这里给一条就近的入口；
 * 运行中/过渡态点击不给任何反馈，避免运行中的误触打断服务。
 *
 * 核心名、模式、配置文件名都来自内核侧的真实状态；下发失败的原因
 * （没装核心、配置有误等）显示在横幅下方。
 */
export function ServiceBanner() {
  const service = useService();
  const { open } = useDrawer();
  const { phase, error, transitioning } = service;
  const uptime = uptimeLabel(service);
  const interactive = phase === 'stopped';

  const tone: ReactNode = transitioning ? <Spinner /> : null;

  const handleOpen = () => {
    if (interactive) {
      open('proxyBasic');
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) {
      return;
    }

    // 横幅本身是可聚焦的普通容器，这里只接管回车/空格两个"激活"键，
    // 其余按键照常冒泡，不影响页面上的其他快捷键。
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open('proxyBasic');
    }
  };

  return (
    <>
      <div
        className={`${styles.banner} ${styles[phase]} ${interactive ? styles.interactive : ''}`}
        // 非停止态既不挂 role/tabIndex，也不响应点击，
        // 语义上退回成一条纯展示的横幅。
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive ? '打开基础代理配置' : undefined}
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.content}>
          <div className={styles.status}>
            <span className={styles.dot} />
            <span className={styles.statusText} key={phase}>
              {transitionLabel(phase)}
            </span>
          </div>

          {uptime ? <div className={styles.uptime}>{uptime}</div> : null}

          <div className={styles.meta}>
            {tone}
            {coreLabel(service)}
          </div>
          {service.configFile ? <div className={styles.meta}>{service.configFile}</div> : null}
        </div>

        <div className={styles.artWrap}>
          {phase === 'stopped' ? <StoppedArt /> : null}
          {phase === 'running' ? <RunningArt /> : null}
        </div>

        {transitioning ? <TransitionBar /> : null}
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}
    </>
  );
}

/** "sing-box · TPROXY"；核心或模式还没探到时只显示探到的那一半 */
function coreLabel(service: ServiceSnapshot): string {
  const mode = service.mode ? service.mode.toUpperCase() : '';

  if (service.core && mode) {
    return `${service.core} · ${mode}`;
  }

  return service.core || mode || '等待状态';
}
