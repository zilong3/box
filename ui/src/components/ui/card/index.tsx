import type { CSSProperties, ReactNode } from 'react';

import styles from './index.module.less';

interface CardProps {
  children: ReactNode;
  /** tight 用于卡片内边距更小的场景，例如提示块 */
  size?: 'normal' | 'tight';
  /** 分组卡：内部行之间带分隔线 */
  grouped?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

/** 截图里的圆角白卡片，是整个面板的基础容器 */
export function Card({ children, size = 'normal', grouped, className, style, onClick }: CardProps) {
  const classes = [
    styles.card,
    size === 'tight' ? styles.tight : '',
    grouped ? styles.grouped : '',
    onClick ? styles.clickable : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} style={style} onClick={onClick} role={onClick ? 'button' : undefined}>
      {children}
    </div>
  );
}
