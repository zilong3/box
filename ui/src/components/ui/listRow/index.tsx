import type { ReactNode } from 'react';

import styles from './index.module.less';

interface ListRowProps {
  /** 左侧图标 */
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** 右侧自定义内容，例如开关、下拉、数值 */
  extra?: ReactNode;
  /** 是否显示右箭头 */
  arrow?: boolean;
  onClick?: () => void;
  /** 行间距更紧凑 */
  dense?: boolean;
}

/** 设置 / 工具列表里的一行：图标 + 标题 + 副标题 + 右侧控件 */
export function ListRow({ icon, title, subtitle, extra, arrow, onClick, dense }: ListRowProps) {
  const classes = [styles.row, dense ? styles.dense : '', onClick ? styles.clickable : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} onClick={onClick} role={onClick ? 'button' : undefined}>
      {icon ? <span className={styles.icon}>{icon}</span> : null}
      <span className={styles.body}>
        <span className={styles.title}>{title}</span>
        {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
      </span>
      {extra ? <span className={styles.extra}>{extra}</span> : null}
      {arrow ? <span className={styles.arrow}>›</span> : null}
    </div>
  );
}

/** 分组卡内相邻行之间的分隔线，跟随内容起始位置缩进 */
export function RowDivider({ inset }: { inset?: boolean }) {
  return <div className={inset ? styles.dividerInset : styles.divider} />;
}
