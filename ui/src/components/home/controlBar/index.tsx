import { transitionLabel, useService, type ServiceAction } from '@/state/service';

import styles from './index.module.less';

interface ControlItem {
  key: ServiceAction;
  label: string;
  /** 停止是破坏性操作，用红色，重启用琥珀色 */
  tone: 'default' | 'danger' | 'warning';
}

/**
 * 首页操作条。
 *
 * 已停止时只有一个"启动"按钮；运行中/过渡态时是重载·停止·重启三按钮。
 *
 * 判据只有一个：`transitioning`。状态与按钮**同帧切换**，所以只要按钮露出来
 * 就一定可点，不存在"按钮已出现但仍灰着"的中间态 —— 那段收尾时间仍算过渡态，
 * 显示的是转圈而不是灰按钮。
 */
export function ControlBar() {
  const { phase, transitioning, ready, dispatch, transitionSeconds } = useService();

  // 状态还没探回来之前先不给按钮，避免误点了"启动"其实是"停止"
  if (!ready && phase === 'stopped') {
    return (
      <div className={styles.bar}>
        <div className={styles.singleBusy}>
          <span className={styles.spinner} />
          正在读取状态
        </div>
      </div>
    );
  }

  if (phase === 'stopped') {
    // 过渡态（正在启动）时依旧占满整条，保持与"启动"按钮同宽同高，
    // 避免"已停止 → 正在启动"这一步横向抽动
    if (transitioning) {
      return (
        <div className={styles.bar}>
          <div className={styles.singleBusy}>
            <span className={styles.spinner} />
            <span className={styles.busyText}>{transitionLabel(phase)}</span>
            {transitionSeconds >= 1 ? (
              <span className={styles.busyHint}>{transitionSeconds}s</span>
            ) : null}
          </div>
        </div>
      );
    }

    return (
      <button type="button" className={styles.single} onClick={() => dispatch('start')}>
        启动
      </button>
    );
  }

  if (transitioning) {
    return (
      <div className={styles.bar}>
        <div className={styles.singleBusy}>
          <span className={styles.spinner} />
          <span className={styles.busyText}>{transitionLabel(phase)}</span>
          {transitionSeconds >= 1 ? (
            <span className={styles.busyHint}>{transitionSeconds}s</span>
          ) : null}
        </div>
      </div>
    );
  }

  const items: ControlItem[] = [
    { key: 'reload', label: '重载', tone: 'default' },
    { key: 'stop', label: '停止', tone: 'danger' },
    { key: 'restart', label: '重启', tone: 'warning' },
  ];

  return (
    <div className={styles.bar}>
      {items.map((item, index) => (
        <div key={item.key} className={styles.slot}>
          {index > 0 ? <span className={styles.divider} /> : null}
          <button
            type="button"
            className={`${styles.action} ${styles[item.tone]}`}
            // 三个按钮只在"操作已结束"时出现，所以永远可点：
            // 收尾期间显示的是上面的转圈条，不会走到这里。
            onClick={() => dispatch(item.key)}
          >
            {item.label}
          </button>
        </div>
      ))}
    </div>
  );
}
