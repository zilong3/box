import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * 二级页面的路由表。
 *
 * 首页、工具、设置是 Tab；这里的页面统一用抽屉（Drawer）承载，
 * 所以"日志查看"在首页和工具里各有一个入口，但打开的是同一个页面 id。
 */
export type DrawerRoute =
  | 'log'
  | 'fileManager'
  | 'appManager'
  | 'subscription'
  | 'updateWebui'
  | 'updateCore'
  | 'proxyBasic'
  | 'proxyOther'
  | 'theme'
  | 'about';

interface DrawerContextValue {
  /** 当前打开的抽屉，null 表示全部关闭 */
  route: DrawerRoute | null;
  open: (route: DrawerRoute) => void;
  close: () => void;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<DrawerRoute | null>(null);

  const open = useCallback((next: DrawerRoute) => setRoute(next), []);
  const close = useCallback(() => setRoute(null), []);

  const value = useMemo<DrawerContextValue>(() => ({ route, open, close }), [route, open, close]);

  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
}

export function useDrawer(): DrawerContextValue {
  const context = useContext(DrawerContext);

  if (!context) {
    throw new Error('useDrawer 必须在 <DrawerProvider> 内部使用');
  }

  return context;
}
