import { TabBar } from '../tabBar';
import { DrawerHost } from '@/components/drawers/drawerHost';
import { HomePage } from '@/pages/homePage';
import { SettingsPage } from '@/pages/settingsPage';
import { ToolsPage } from '@/pages/toolsPage';
import { useTab } from '@/state/tabs';

import styles from './index.module.less';

/** 应用外壳：当前 Tab 页面 + 底部导航 + 全局抽屉宿主 */
export function AppShell() {
  const { tab, setTab } = useTab();

  return (
    <div className={styles.shell}>
      <main className={styles.content}>
        {tab === 'home' ? <HomePage /> : null}
        {tab === 'tools' ? <ToolsPage /> : null}
        {tab === 'settings' ? <SettingsPage /> : null}
      </main>

      <TabBar active={tab} onChange={setTab} />

      {/* 所有二级页面抽屉统一挂在这里，任意 Tab 都能唤起 */}
      <DrawerHost />
    </div>
  );
}
