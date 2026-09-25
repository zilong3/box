import { useCallback, useState } from 'react';
import { ControlOutlined } from '@ant-design/icons';

import { PageHeader } from '@/components/ui/pageHeader';
import { PageLayout } from '@/components/layout/pageLayout';
import { TileGrid } from '@/components/ui/tileGrid';
import { ControlBar } from '@/components/home/controlBar';
import { ServiceBanner } from '@/components/home/serviceBanner';
import { EmbeddedPanel } from '@/components/ui/embeddedPanel';
import { IconButton } from '@/components/ui/iconButton';
import { PanelSwitcher } from '@/components/ui/panelSwitcher';
import { DEFAULT_WEBUI_PANEL, SUB_STORE_URL, type WebuiPanel } from '@/config/panels';
import { useDrawer } from '@/state/drawer';

import styles from './index.module.less';

/** 本页内嵌打开的外部面板 */
type EmbedTarget = 'subStore' | 'webui' | null;

/**
 * 首页：状态横幅 + 操作条 + 快捷入口。
 *
 * 快捷入口里的"日志"与工具页的"日志查看"是同一个抽屉路由，
 * 两处入口共用一套 logs 状态，从哪进看到的都一样。
 *
 * Sub-Store 与 WebUI 都是本页自己管理的整屏内嵌视图（iframe）：
 * WebUI 可以在顶栏切换面板，选中的面板会被记住，下次直接打开它。
 */
export function HomePage() {
  const { open } = useDrawer();
  const [target, setTarget] = useState<EmbedTarget>(null);
  const [panel, setPanel] = useState<WebuiPanel>(DEFAULT_WEBUI_PANEL);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const closeEmbed = useCallback(() => {
    setTarget(null);
    // 关闭时收起切换弹层，避免下次打开时残留
    setSwitcherOpen(false);
  }, []);

  const openSubStore = useCallback(() => setTarget('subStore'), []);
  const openWebui = useCallback(() => setTarget('webui'), []);

  return (
    <>
      {/* 首页内容：打开面板时整块隐藏，但组件不卸载，状态与滚动位置都留着 */}
      <div className={styles.page} hidden={target !== null}>
        <PageLayout>
          <PageHeader title="BOX" />

          <ServiceBanner />
          <ControlBar />

          <TileGrid
            tiles={[
              {
                key: 'webui',
                title: 'WebUI',
                subtitle: 'Web 界面',
                // 整屏内嵌打开，顶栏可切换面板
                onClick: openWebui,
              },
              {
                key: 'sub-store',
                title: 'Sub-Store',
                subtitle: '管理',
                // 整屏内嵌 iframe 打开面板，不再唤起抽屉
                onClick: openSubStore,
              },
              {
                key: 'log',
                title: '日志',
                subtitle: '查看',
                // 首页入口，与工具页共用 'log' 路由
                onClick: () => open('log'),
              },
            ]}
          />
        </PageLayout>
      </div>

      <EmbeddedPanel
        open={target === 'subStore'}
        url={SUB_STORE_URL}
        title="Sub-Store"
        onClose={closeEmbed}
      />

      <EmbeddedPanel
        open={target === 'webui'}
        url={panel.url}
        title={panel.name}
        onClose={closeEmbed}
        actions={
          <IconButton
            icon={<ControlOutlined />}
            label="切换面板"
            onClick={() => setSwitcherOpen(true)}
          />
        }
      />

      <PanelSwitcher
        open={target === 'webui' && switcherOpen}
        active={panel.key}
        onSelect={setPanel}
        onClose={() => setSwitcherOpen(false)}
      />
    </>
  );
}
