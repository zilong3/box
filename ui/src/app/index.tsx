import { useEffect, useLayoutEffect } from 'react';
import { App as AntdApp, ConfigProvider, theme } from 'antd';
import zhCN from 'antd/es/locale/zh_CN';

import { AppShell } from '@/components/layout/appShell';
import { enableEdgeToEdge, fullScreen } from '@/bridge';
import { AppProvider } from '@/state/apps';
import { DrawerProvider } from '@/state/drawer';
import { LogProvider } from '@/state/logs';
import { PreferencesProvider, usePreferences } from '@/state/preferences';
import { ServiceProvider } from '@/state/service';
import { SubscriptionProvider } from '@/state/subscriptions';
import { TabProvider } from '@/state/tabs';

import styles from './index.module.less';

export default function App() {
  useEffect(() => {
    // 让页面铺满 WebView，并按安全区留出内边距
    fullScreen(true);
    enableEdgeToEdge(true);
  }, []);

  return (
    <PreferencesProvider>
      <ThemedApp />
    </PreferencesProvider>
  );
}

/** 主题由偏好里的深色模式开关驱动，antd 主题与 CSS 变量保持一致 */
function ThemedApp() {
  const { preferences } = usePreferences();
  const dark = preferences.darkMode;

  useLayoutEffect(() => {
    // 深浅色主要靠 CSS 变量，用属性标记让 tokens.less 的不跟随系统媒体查询
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }, [dark]);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#3b82f6',
          borderRadius: 14,
          fontSize: 16,
        },
      }}
    >
      <AntdApp
        // 提示改走 notification 而不是 message。
        //
        // 原因：antd 6 的 **message 只支持顶部**（useMessage.js / PureList.js 都把
        // placement 写死成 'top'，配置项里也没有 placement，只有 top 偏移）。
        // 而面板顶部有摄像头挖孔，弹在那里会被挡住。
        //
        // notification 原生支持 placement: 'bottom' 和 bottom 偏移，
        // 是 antd 自己的参数，不用跟内部样式较劲。
        //
        // 但 notification 默认的卡片比 message 大一圈（内边距用 paddingMD/
        // paddingContentHorizontalLG，标题行也更高）。这里用 antd 提供的
        // styles 语义槽把它压回 message 那种紧凑胶囊：贴紧的内边距、
        // 圆角、以及"内容不换行时高度刚好包住文字"。
        notification={{
          placement: 'bottom',
          // 离底边多远：让开 58px 标签栏后再留一截，避免贴着标签栏
          bottom: 104,
          stack: false,
          // 视觉对齐 message：紧凑内边距 + 小圆角 + 阴影
          styles: {
            root: {
              // 收紧卡片内边距（默认是 paddingMD / paddingContentHorizontalLG）
              padding: '8px 14px',
              width: 'max-content',
              maxWidth: 'calc(100vw - 32px)',
              borderRadius: 10,
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
            },
            // 图标与文字垂直居中。
            //
            // notification 默认是 alignItems: 'flex-start'（而 message 用
            // 'center'），它假定卡片里有"标题 + 描述"多行内容，图标顶对齐更
            // 合理。但我们只放一行标题，顶对齐会让图标偏上、和文字不在一条
            // 中线上。这里改回 center，跟原来的 message 观感一致。
            wrapper: {
              alignItems: 'center',
            },
            // 标题就是全部内容，压掉多余的行高，让高度贴近 message 的一行字
            title: {
              fontSize: 15,
              lineHeight: 1.4,
            },
            // 只有标题、没有描述时不留空档
            description: {
              marginTop: 0,
            },
          },
        }}
      >
        {/* 状态层：服务状态、偏好、订阅、日志、应用规则、Tab、抽屉路由 */}
        <ServiceProvider>
          <SubscriptionProvider>
            <LogProvider>
              <AppProvider>
                <TabProvider>
                  <DrawerProvider>
                    <div className={styles.app}>
                      <AppShell />
                    </div>
                  </DrawerProvider>
                </TabProvider>
              </AppProvider>
            </LogProvider>
          </SubscriptionProvider>
        </ServiceProvider>
      </AntdApp>
    </ConfigProvider>
  );
}
