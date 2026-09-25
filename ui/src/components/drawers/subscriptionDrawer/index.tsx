import { DeleteOutlined, DownloadOutlined, PlusCircleOutlined, SaveOutlined } from '@ant-design/icons';
import { Input, Switch } from 'antd';

import { Card } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { IconButton } from '@/components/ui/iconButton';
import { toast } from '@/bridge';
import { useDrawer } from '@/state/drawer';
import { usePreferences } from '@/state/preferences';
import { useSubscriptions, type SubscriptionGroup } from '@/state/subscriptions';

import styles from './index.module.less';

/** 一组核心下的订阅源，各核心均支持多条可增删 */
function GroupBlock({ group }: { group: SubscriptionGroup }) {
  const { addEntry, removeEntry, updateEntry } = useSubscriptions();

  return (
    <Card className={styles.group}>
      <div className={styles.groupTitle}>{group.title}</div>

      {group.entries.map((entry) => (
        <div key={entry.id} className={styles.entry}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>名称</span>
            <div className={styles.fieldRow}>
              <Input
                variant="borderless"
                value={entry.name}
                placeholder="名称"
                // 名称通常很短，聚焦时光标落在文字后面，与截图一致
                onFocus={(event) => event.currentTarget.setSelectionRange(0, 0)}
                className={styles.input}
                onChange={(event) =>
                  updateEntry(group.id, entry.id, { name: event.target.value })
                }
              />
              <button
                type="button"
                className={styles.remove}
                aria-label="删除该订阅"
                onClick={() => removeEntry(group.id, entry.id)}
              >
                <DeleteOutlined />
              </button>
            </div>
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>链接</span>
            <Input
              variant="borderless"
              value={entry.url}
              placeholder="https://"
              className={styles.input}
              onChange={(event) => updateEntry(group.id, entry.id, { url: event.target.value })}
            />
          </label>
        </div>
      ))}

      <button type="button" className={styles.add} onClick={() => addEntry(group.id)}>
        <PlusCircleOutlined />
        添加一项
      </button>
    </Card>
  );
}

/** 订阅管理抽屉：开关 + 各核心订阅分组 */
export function SubscriptionDrawer() {
  const { route, close } = useDrawer();
  const { groups } = useSubscriptions();
  const { preferences, update } = usePreferences();

  return (
    <Drawer
      open={route === 'subscription'}
      onClose={close}
      title="订阅管理"
      actions={
        <>
          <IconButton
            icon={<SaveOutlined />}
            label="保存"
            onClick={() => toast('订阅配置已保存（预览模式）')}
          />
          <IconButton
            icon={<DownloadOutlined />}
            label="立即更新订阅"
            onClick={() => toast('开始更新订阅（预览模式）')}
          />
        </>
      }
    >
      <div className={styles.body}>
        <Card size="tight">
          <div className={styles.switchRow}>
            <span className={styles.switchLabel}>更新订阅</span>
            <Switch
              checked={preferences.updateSubscription}
              onChange={(checked) => update('updateSubscription', checked)}
            />
          </div>
        </Card>

        {groups.map((group) => (
          <GroupBlock key={group.id} group={group} />
        ))}
      </div>
    </Drawer>
  );
}
