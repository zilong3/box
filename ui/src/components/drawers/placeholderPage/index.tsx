import type { ReactNode } from 'react';

import { Drawer } from '@/components/ui/drawer';
import { useDrawer, type DrawerRoute } from '@/state/drawer';

import styles from './index.module.less';

interface PlaceholderPageProps {
  /** 当前占位页对应的抽屉路由 */
  route: DrawerRoute;
  title: string;
  description?: string;
  icon?: ReactNode;
}

/**
 * 尚未实现的二级页面占位抽屉。
 *
 * 目前只做静态页面，先把入口与抽屉骨架搭好；
 * 后续接入 bridge / kernel 时逐个替换成真实实现即可。
 */
export function PlaceholderPage({ route, title, description, icon }: PlaceholderPageProps) {
  const { close, route: active } = useDrawer();

  return (
    <Drawer open={active === route} onClose={close} title={title}>
      <div className={styles.body}>
        {icon ? <div className={styles.icon}>{icon}</div> : null}
        <div className={styles.title}>功能开发中</div>
        <div className={styles.description}>
          {description ?? '该功能尚未实现，接入 bridge 与 kernel 后开放。'}
        </div>
      </div>
    </Drawer>
  );
}
