import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/** 一条订阅源 */
export interface SubscriptionEntry {
  id: string;
  name: string;
  url: string;
}

/** 某个核心下的订阅配置，各核心均支持多条可增删 */
export interface SubscriptionGroup {
  id: string;
  /** 展示名，例如 Mihomo / Sing-Box / Xray */
  title: string;
  entries: SubscriptionEntry[];
}

interface SubscriptionContextValue {
  groups: SubscriptionGroup[];
  addEntry: (groupId: string) => void;
  removeEntry: (groupId: string, entryId: string) => void;
  updateEntry: (groupId: string, entryId: string, patch: Partial<SubscriptionEntry>) => void;
}

const INITIAL_GROUPS: SubscriptionGroup[] = [
  {
    id: 'mihomo',
    title: 'Mihomo',
    entries: [{ id: 'mihomo-1', name: 'nodes', url: 'https://www.zilong3.top:8003/' }],
  },
  {
    id: 'sing-box',
    title: 'Sing-Box',
    entries: [{ id: 'singbox-1', name: 'nodes', url: 'https://www.zilong3.top:8003/backend' }],
  },
  {
    id: 'xray',
    title: 'Xray',
    entries: [{ id: 'xray-1', name: 'nodes', url: '' }],
  },
];

let seq = 0;
const nextId = () => `entry-${Date.now()}-${(seq += 1)}`;

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [groups, setGroups] = useState<SubscriptionGroup[]>(INITIAL_GROUPS);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      groups,
      addEntry: (groupId) =>
        setGroups((current) =>
          current.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  entries: [...group.entries, { id: nextId(), name: 'new_nodes', url: '' }],
                }
              : group,
          ),
        ),
      removeEntry: (groupId, entryId) =>
        setGroups((current) =>
          current.map((group) =>
            group.id === groupId
              ? { ...group, entries: group.entries.filter((entry) => entry.id !== entryId) }
              : group,
          ),
        ),
      updateEntry: (groupId, entryId, patch) =>
        setGroups((current) =>
          current.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  entries: group.entries.map((entry) =>
                    entry.id === entryId ? { ...entry, ...patch } : entry,
                  ),
                }
              : group,
          ),
        ),
    }),
    [groups],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscriptions(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);

  if (!context) {
    throw new Error('useSubscriptions 必须在 <SubscriptionProvider> 内部使用');
  }

  return context;
}
