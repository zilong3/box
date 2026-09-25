import { Drawer as AntdDrawer } from 'antd';
import type { ReactNode } from 'react';

import styles from './index.module.less';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** 标题右侧的图标操作区 */
  actions?: ReactNode;
  children: ReactNode;
  /** 底部固定操作区（例如订阅管理的确定按钮） */
  footer?: ReactNode;
}

/**
 * 统一的二级页面抽屉。
 *
 * 截图里日志页顶部有返回箭头和图标操作区，所以这里用 antd Drawer 的
 * placement="bottom" + 自定义 header 来实现整屏抽屉，而不是 antd 默认的侧边栏。
 */
export function Drawer({ open, onClose, title, actions, children, footer }: DrawerProps) {
  return (
    <AntdDrawer
      open={open}
      onClose={onClose}
      placement="bottom"
      height="100%"
      closable={false}
      rootClassName={styles.drawer}
      styles={{ body: { padding: 0 } }}
    >
      <div className={styles.shell}>
        <div className={styles.header}>
          <button type="button" className={styles.back} onClick={onClose} aria-label="返回">
            ←
          </button>
          <div className={styles.actions}>{actions}</div>
        </div>
        <div className={styles.body}>
          <h1 className={styles.title}>{title}</h1>
          {children}
        </div>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </AntdDrawer>
  );
}
