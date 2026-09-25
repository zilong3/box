import { Button, Spin } from 'antd';
import type { ReactNode } from 'react';

import styles from './index.module.less';

interface StateBlockProps {
  /** 顶部图标（进行中会自动换成转圈） */
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  loading?: boolean;
}

/** 空状态 / 加载中占位，日志清空后和未实现页面共用 */
export function StateBlock({ icon, title, description, action, loading }: StateBlockProps) {
  return (
    <div className={styles.block}>
      <div className={styles.icon}>{loading ? <Spin /> : icon}</div>
      <div className={styles.title}>{title}</div>
      {description ? <div className={styles.description}>{description}</div> : null}
      {action ? (
        <Button type="primary" className={styles.action} onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
