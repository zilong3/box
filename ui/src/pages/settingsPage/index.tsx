import {
  DownloadOutlined,
  InfoCircleOutlined,
  MoonOutlined,
  SkinOutlined,
  SlidersOutlined,
} from '@ant-design/icons';

import { PageHeader } from '@/components/ui/pageHeader';
import { PageLayout } from '@/components/layout/pageLayout';
import { FormRow, SwitchRow } from '@/components/ui/formRow';
import { ListRow } from '@/components/ui/listRow';
import { Section } from '@/components/ui/section';
import { useDrawer } from '@/state/drawer';
import { usePreferences } from '@/state/preferences';

import styles from './index.module.less';

/** 其他代理配置图标（两个滑块） */
function TuneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true">
      <rect x="3" y="4" width="18" height="7" rx="2.2" fill="currentColor" />
      <rect x="3" y="13" width="18" height="7" rx="2.2" fill="currentColor" />
      <circle cx="15.5" cy="7.5" r="1.7" fill="var(--box-card-bg)" />
      <circle cx="8.5" cy="16.5" r="1.7" fill="var(--box-card-bg)" />
    </svg>
  );
}

/** 设置页：代理配置、外观与下载偏好 */
export function SettingsPage() {
  const { open } = useDrawer();
  const { preferences, update } = usePreferences();

  return (
    <PageLayout>
      <PageHeader title="设置" />

      <Section>
        <ListRow
          icon={<SlidersOutlined />}
          title="基础代理配置"
          subtitle="配置核心 模式 IPv6 和当前配置"
          arrow
          onClick={() => open('proxyBasic')}
        />
        <ListRow
          icon={<TuneIcon />}
          title="其他代理配置"
          subtitle="调整端口 DNS 劫持与资源限制"
          arrow
          onClick={() => open('proxyOther')}
        />
      </Section>

      <Section>
        <ListRow
          icon={<SkinOutlined />}
          title="主题设置"
          subtitle="调整主题 模糊 底栏和缩放"
          arrow
          onClick={() => open('theme')}
        />
        <SwitchRow
          label={
            <span className={styles.withIcon}>
              <MoonOutlined />
              深色模式
            </span>
          }
          checked={preferences.darkMode}
          onChange={(checked) => update('darkMode', checked)}
        />
      </Section>

      <Section>
        <SwitchRow
          label={
            <span className={styles.withIcon}>
              <DownloadOutlined />
              加速下载
            </span>
          }
          checked={preferences.fastDownload}
          onChange={(checked) => update('fastDownload', checked)}
        />
      </Section>

      <Section>
        <FormRow
          label={
            <span className={styles.withIcon}>
              <InfoCircleOutlined />
              关于
            </span>
          }
          extra={<span className={styles.arrow}>›</span>}
          onClick={() => open('about')}
        />
      </Section>
    </PageLayout>
  );
}
