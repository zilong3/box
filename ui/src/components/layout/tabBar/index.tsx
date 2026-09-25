import { HomeFilled, HomeOutlined, SettingFilled, SettingOutlined } from '@ant-design/icons';

import type { TabKey } from '@/state/tabs';

import styles from './index.module.less';

interface TabBarProps {
  active: TabKey;
  onChange: (key: TabKey) => void;
}

interface TabItem {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
}

/** 工具 Tab 用四宫格图标，这里用内联 SVG 更接近截图里的方块造型 */
function GridIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <g fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9">
        <rect x="3.2" y="3.2" width="7.2" height="7.2" rx="2" />
        <rect x="13.6" y="3.2" width="7.2" height="7.2" rx="2" />
        <rect x="3.2" y="13.6" width="7.2" height="7.2" rx="2" />
        <rect x="13.6" y="13.6" width="7.2" height="7.2" rx="2" />
      </g>
    </svg>
  );
}

const TABS: TabItem[] = [
  { key: 'home', label: '首页', icon: <HomeOutlined />, activeIcon: <HomeFilled /> },
  {
    key: 'tools',
    label: '工具',
    icon: <GridIcon filled={false} />,
    activeIcon: <GridIcon filled />,
  },
  { key: 'settings', label: '设置', icon: <SettingOutlined />, activeIcon: <SettingFilled /> },
];

/** 底部三段式导航，选中项用实心图标 + 加粗文字 */
export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav className={styles.bar}>
      {TABS.map((tab) => {
        const selected = tab.key === active;

        return (
          <button
            key={tab.key}
            type="button"
            data-tab={tab.key}
            className={`${styles.item} ${selected ? styles.active : ''}`}
            onClick={() => onChange(tab.key)}
            aria-current={selected ? 'page' : undefined}
          >
            <span className={styles.icon}>{selected ? tab.activeIcon : tab.icon}</span>
            <span className={styles.label}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
