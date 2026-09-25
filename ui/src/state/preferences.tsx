import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/** 界面与代理偏好，设置页里可调的项都落在这里 */
export interface Preferences {
  /** 为下载资源启用加速通道 */
  fastDownload: boolean;
  proxyCore: string;
  proxyMode: string;
  ipv6: boolean;
  autoOverride: boolean;
  activeConfig: string;
  configList: string[];
  /** 启动时自动更新订阅 */
  updateSubscription: boolean;
  /** 使用深色主题（关闭时固定为浅色，不再跟随系统） */
  darkMode: boolean;
}

const DEFAULT_PREFERENCES: Preferences = {
  fastDownload: false,
  proxyCore: 'Sing-Box',
  proxyMode: 'TPROXY',
  ipv6: false,
  autoOverride: true,
  activeConfig: 'config.json',
  configList: ['config.json'],
  updateSubscription: true,
  darkMode: false,
};

interface PreferencesContextValue {
  preferences: Preferences;
  /** 合并式更新单个偏好 */
  update: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      update: (key, next) => setPreferences((current) => ({ ...current, [key]: next })),
    }),
    [preferences],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);

  if (!context) {
    throw new Error('usePreferences 必须在 <PreferencesProvider> 内部使用');
  }

  return context;
}
