import {
  AppstoreFilled,
  DownloadOutlined,
  FileTextOutlined,
  LinkOutlined,
  ProjectOutlined,
} from '@ant-design/icons';

import { PageHeader } from '@/components/ui/pageHeader';
import { PageLayout } from '@/components/layout/pageLayout';
import { ListRow } from '@/components/ui/listRow';
import { Section } from '@/components/ui/section';
import { useDrawer } from '@/state/drawer';
import { usePreferences } from '@/state/preferences';

import styles from './index.module.less';

/**
 * 工具页：文件管理、日志、应用管理、订阅与核心更新。
 *
 * "日志查看"这里是一个入口，首页快捷入口的"日志"打开的是同一个抽屉。
 */
export function ToolsPage() {
  const { open } = useDrawer();
  const { preferences } = usePreferences();

  return (
    <PageLayout>
      <PageHeader title="工具" />

      <Section>
        <ListRow
          icon={<ProjectOutlined />}
          title="模块文件管理"
          subtitle="查看与处理模块文件"
          arrow
          onClick={() => open('fileManager')}
        />
        <ListRow
          icon={<FileTextOutlined />}
          title="日志查看"
          subtitle="查看运行日志与调试输出"
          arrow
          onClick={() => open('log')}
        />
        <ListRow
          icon={<AppstoreFilled />}
          title="应用管理"
          subtitle="查看并管理应用相关规则"
          arrow
          onClick={() => open('appManager')}
        />
      </Section>

      <Section>
        <ListRow
          icon={<LinkOutlined />}
          title="订阅管理"
          subtitle="配置订阅源并更新规则数据"
          arrow
          onClick={() => open('subscription')}
        />
      </Section>

      <Section>
        <ListRow
          icon={<DownloadOutlined />}
          title="更新核心"
          subtitle="选择核心并启动更新流程"
          // 右侧显示当前核心名，与截图一致
          extra={<span className={styles.action}>{preferences.proxyCore}</span>}
          arrow
          onClick={() => open('updateCore')}
        />
      </Section>
    </PageLayout>
  );
}
