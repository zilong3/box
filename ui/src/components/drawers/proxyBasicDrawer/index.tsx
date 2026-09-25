import { CheckOutlined } from '@ant-design/icons';
import { Switch } from 'antd';

import { Card } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { FormRow, SelectRow } from '@/components/ui/formRow';
import { useDrawer } from '@/state/drawer';
import { usePreferences } from '@/state/preferences';

import styles from './index.module.less';

const CORE_OPTIONS = ['Sing-Box', 'Xray', 'Mihomo'];
const MODE_OPTIONS = ['TUN', 'TPROXY', 'eBPF', 'Redirect', 'Mixed', 'Enhance'];

/**
 * 基础代理配置抽屉：核心、模式、IPv6、自动覆写、启动配置选择。
 *
 * 核心选择与运行模式都使用 SelectRow：右侧灰色当前值 + 上下箭头，
 * 点击整行弹出圆角选项菜单（选中项蓝色 + 对勾）。
 *
 * 核心/模式以 preferences 为准（ServiceProvider 在外层拿不到偏好，
 * 其 core/mode 是固定演示值），这样菜单里的选中项才能跟着选择变化。
 */
export function ProxyBasicDrawer() {
  const { route, close } = useDrawer();
  const { preferences, update } = usePreferences();

  const open = route === 'proxyBasic';

  return (
    <Drawer open={open} onClose={close} title="基础代理配置">
      <div className={styles.body}>
        <Card grouped>
          <SelectRow
            label="核心选择"
            value={preferences.proxyCore}
            options={CORE_OPTIONS}
            onChange={(value) => update('proxyCore', value)}
          />
          <SelectRow
            label="运行模式"
            value={preferences.proxyMode}
            options={MODE_OPTIONS}
            onChange={(value) => update('proxyMode', value)}
          />
          <FormRow
            label="IPv6"
            extra={
              <Switch
                checked={preferences.ipv6}
                onChange={(checked) => update('ipv6', checked)}
              />
            }
          />
          <FormRow
            label="自动覆写"
            extra={
              <Switch
                checked={preferences.autoOverride}
                onChange={(checked) => update('autoOverride', checked)}
              />
            }
          />
        </Card>

        <Card grouped>
          <div className={styles.configHead}>
            <span className={styles.configTitle}>配置选择</span>
          </div>

          {preferences.configList.map((name) => (
            <button
              key={name}
              type="button"
              className={styles.configItem}
              onClick={() => update('activeConfig', name)}
            >
              <span className={styles.configName}>{name}</span>
              {preferences.activeConfig === name ? (
                <CheckOutlined className={styles.check} />
              ) : null}
            </button>
          ))}
        </Card>
      </div>
    </Drawer>
  );
}
