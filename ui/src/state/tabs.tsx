import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/** 底部 Tab 的三个页面 */
export type TabKey = 'home' | 'tools' | 'settings';

interface TabContextValue {
  tab: TabKey;
  setTab: (tab: TabKey) => void;
}

const TabContext = createContext<TabContextValue | null>(null);

/**
 * Tab 切换状态。
 *
 * 面板只有三个 Tab，且 WebView 里以 file:// 加载时 history 路由容易出问题，
 * 所以用一个轻量 context 管理当前 Tab，不引入路由库。
 */
export function TabProvider({ children }: { children: ReactNode }) {
  const [tab, setTabState] = useState<TabKey>('home');

  const setTab = useCallback((next: TabKey) => setTabState(next), []);

  const value = useMemo<TabContextValue>(() => ({ tab, setTab }), [tab, setTab]);

  return <TabContext.Provider value={value}>{children}</TabContext.Provider>;
}

export function useTab(): TabContextValue {
  const context = useContext(TabContext);

  if (!context) {
    throw new Error('useTab 必须在 <TabProvider> 内部使用');
  }

  return context;
}
