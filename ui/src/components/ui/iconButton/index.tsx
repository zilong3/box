import type { ReactNode } from 'react';

import styles from './index.module.less';

interface IconButtonProps {
  icon: ReactNode;
  /** 无障碍名称；不再渲染成 tip 气泡，只作为 aria-label */
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  /** 危险操作（清空日志）用红色 */
  danger?: boolean;
  /** 选中态：图标高亮成主题色（例如搜索框已展开） */
  active?: boolean;
  spinning?: boolean;
}

/**
 * 抽屉标题栏右侧的图标按钮。
 *
 * 这里刻意不使用 antd Tooltip：面板是触屏界面，长按弹出的黑色气泡并不合适，
 * label 只作为 aria-label 提供给读屏与自动化测试。
 */
export function IconButton({
  icon,
  label,
  onClick,
  disabled,
  danger,
  active,
  spinning,
}: IconButtonProps) {
  const classes = [
    styles.button,
    danger ? styles.danger : '',
    active ? styles.active : '',
    spinning ? styles.spinning : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
    >
      {icon}
    </button>
  );
}
