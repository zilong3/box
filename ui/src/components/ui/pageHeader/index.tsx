import type { ReactNode } from 'react';

import styles from './index.module.less';

interface PageHeaderProps {
  title: string;
  /** 右侧操作区（抽屉里用于放刷新 / 排序 / 清空等图标按钮） */
  actions?: ReactNode;
  /** 抽屉内的页面标题字号略小 */
  compact?: boolean;
}

/** 页面大标题，首页显示 BOX，其他页显示中文标题 */
export function PageHeader({ title, actions, compact }: PageHeaderProps) {
  return (
    <div className={`${styles.header} ${compact ? styles.compact : ''}`}>
      <h1 className={styles.title}>{title}</h1>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}
