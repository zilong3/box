import type { ReactNode } from 'react';

import styles from './index.module.less';

interface PageLayoutProps {
  children: ReactNode;
}

/** Tab 页的滚动容器：内容不透明滚动，底部为固定 Tab 栏留出空间 */
export function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className={styles.scroll}>
      <div className={styles.inner}>{children}</div>
    </div>
  );
}
