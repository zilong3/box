import { Button, Switch } from 'antd';
import { useState } from 'react';

import { Card } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { toast } from '@/bridge';
import { useDrawer } from '@/state/drawer';
import { usePreferences } from '@/state/preferences';

import styles from './index.module.less';

/** 支持的核心，与基础代理配置里的核心选择保持一致 */
const CORES = ['Sing-Box', 'Xray', 'Mihomo'];

/** 更新核心抽屉：稳定版开关 + 核心单选 + 确认/取消 */
export function UpdateCoreDrawer() {
  const { route, close } = useDrawer();
  const { preferences, update } = usePreferences();
  // 稳定版开关按核心分别记录，默认全部开启
  const [stableMap, setStableMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CORES.map((name) => [name, true])),
  );
  // 默认选中当前正在使用的核心
  const [core, setCore] = useState(preferences.proxyCore);

  const open = route === 'updateCore';

  const confirm = () => {
    // 静态演示：把选择的核心同步到设置里，让工具页右侧标签跟着变
    update('proxyCore', core);
    const suffix = stableMap[core] ? '稳定版' : '测试版';
    toast(`开始更新核心：${core} ${suffix}（预览模式）`);
    close();
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      title="更新核心"
      footer={
        <div className={styles.footer}>
          <Button className={styles.cancel} onClick={close}>
            取消
          </Button>
          <Button type="primary" className={styles.confirm} onClick={confirm}>
            确定
          </Button>
        </div>
      }
    >
      <div className={styles.body}>
        <Card className={styles.stableCard}>
          {CORES.map((name) => (
            <div key={name} className={styles.stableRow}>
              <span className={styles.stableLabel}>{name} 稳定版</span>
              <Switch
                checked={stableMap[name]}
                onChange={(checked) =>
                  setStableMap((current) => ({ ...current, [name]: checked }))
                }
              />
            </div>
          ))}
        </Card>

        <Card className={styles.channelCard}>
          {CORES.map((name) => (
            <button
              key={name}
              type="button"
              className={`${styles.channel} ${core === name ? styles.active : ''}`}
              onClick={() => setCore(name)}
            >
              {name}
            </button>
          ))}
        </Card>
      </div>
    </Drawer>
  );
}
