import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * 应用管理里的三种规则模式，与截图顶部的分段按钮一一对应。
 *
 * - blacklist：黑名单里的应用走代理，其余直连；
 * - whitelist：白名单里的应用直连，其余走代理；
 * - core：给应用单独指定核心。
 */
export type AppMode = 'blacklist' | 'whitelist' | 'core';

/** 一个受管应用 */
export interface ManagedApp {
  /** 包名，同时作为唯一标识 */
  packageName: string;
  /** 应用展示名 */
  name: string;
  /** 黑名单/白名单是否勾选 */
  enabled: boolean;
  /** 核心模式下为应用指定的核心，其余模式为 null */
  core: string | null;
}

interface AppContextValue {
  apps: ManagedApp[];
  /** 当前正在查看的模式分组 */
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  /** 切换某个应用在当前模式下的勾选状态 */
  toggleApp: (packageName: string) => void;
  /** 为核心模式下的应用指定核心 */
  setAppCore: (packageName: string, core: string | null) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

/**
 * 演示数据：包名与截图里的列表保持一致。
 *
 * 真实运行时这里应该改为扫描已安装应用（`pm list packages`）后再合并规则文件，
 * 目前先按静态数据渲染，接入 bridge 后替换 INITIAL_APPS 即可。
 */
const INITIAL_APPS: ManagedApp[] = [
  { packageName: 'com.android.chrome', name: 'Chrome', enabled: true, core: null },
  { packageName: 'com.android.vending', name: 'Google Play 商店', enabled: true, core: null },
  { packageName: 'com.google.android.gms', name: 'Google Play 服务', enabled: true, core: null },
  { packageName: 'com.google.android.gsf', name: 'Google 服务框架', enabled: true, core: null },
  { packageName: 'mark.via.gp', name: 'Via', enabled: true, core: null },
  { packageName: 'io.legado.app.release', name: '阅读', enabled: true, core: null },
  {
    packageName: 'com.android.internal.systemui.navbar.threebutton',
    name: '3 Button Navigation Bar',
    enabled: false,
    core: null,
  },
  {
    packageName: 'com.qualcomm.qti.gpudrivers.canoe',
    name: 'Adreno Graphics Drivers',
    enabled: false,
    core: null,
  },
];

export function AppProvider({ children }: { children: ReactNode }) {
  const [apps, setApps] = useState<ManagedApp[]>(INITIAL_APPS);
  const [mode, setMode] = useState<AppMode>('whitelist');

  const value = useMemo<AppContextValue>(
    () => ({
      apps,
      mode,
      setMode,
      toggleApp: (packageName) =>
        setApps((current) =>
          current.map((app) =>
            app.packageName === packageName ? { ...app, enabled: !app.enabled } : app,
          ),
        ),
      setAppCore: (packageName, core) =>
        setApps((current) =>
          current.map((app) => (app.packageName === packageName ? { ...app, core } : app)),
        ),
    }),
    [apps, mode],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApps(): AppContextValue {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useApps 必须在 <AppProvider> 内部使用');
  }

  return context;
}
