import { useEffect, useRef, useState } from 'react';
import { ClearOutlined, MoreOutlined, ReloadOutlined } from '@ant-design/icons';

import { Drawer } from '@/components/ui/drawer';
import { IconButton } from '@/components/ui/iconButton';
import { StateBlock } from '@/components/ui/stateBlock';
import { useDrawer } from '@/state/drawer';
import { useLogs } from '@/state/logs';

import { LogFileMenu } from '../logFileMenu';
import styles from './index.module.less';

/**
 * 日志查看抽屉。
 *
 * 首页快捷入口的"日志"和工具页的"日志查看"都打开这个抽屉，
 * 共用同一份 logs 状态，因此从哪进看到的日志完全一致。
 * 标题栏"更多"按钮可以切换查看不同的日志文件。
 */
export function LogDrawer() {
  const { route, close } = useDrawer();
  const { logs, refresh, refreshing, clear, activeFile, selectFile, files, filesLoading, error } =
    useLogs();
  const moreRef = useRef<HTMLSpanElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const open = route === 'log';

  // 关闭抽屉时收起文件菜单，避免下次打开时残留
  useEffect(() => {
    if (!open) {
      setMenuOpen(false);
    }
  }, [open]);

  // 三种空态要分清：真出错了 / 还没有日志文件 / 文件是空的
  const emptyState = (() => {
    if (error) {
      return { title: '读取日志失败', description: error };
    }

    if (filesLoading) {
      return { title: '暂无日志', description: '正在读取日志列表…' };
    }

    if (files.length === 0) {
      return {
        title: '暂无日志',
        description: '内核运行目录下还没有 .log 文件，服务启动后产生的日志会显示在这里',
      };
    }

    return {
      title: '暂无日志',
      description: `${activeFile || '当前文件'} 暂无内容，服务运行后产生的日志会显示在这里`,
    };
  })();

  return (
    <>
      <Drawer
        open={open}
        onClose={close}
        title="日志查看"
        actions={
          <>
            <IconButton
              icon={<ReloadOutlined />}
              label="刷新"
              spinning={refreshing}
              onClick={refresh}
            />
            <IconButton
              icon={<ClearOutlined />}
              label="清空日志"
              danger
              disabled={!activeFile || logs.length === 0}
              onClick={clear}
            />
            {/* 用 span 包一层以便把菜单锚定到这个按钮上 */}
            <span ref={moreRef} className={styles.moreWrap}>
              <IconButton
                icon={<MoreOutlined />}
                label="切换日志文件"
                onClick={() => setMenuOpen((value) => !value)}
              />
            </span>
          </>
        }
      >
        {logs.length === 0 ? (
          <StateBlock
            title={emptyState.title}
            description={emptyState.description}
            action={{ label: '刷新', onClick: refresh }}
          />
        ) : (
          <div className={styles.viewer}>
            {logs.map((entry) => (
              <div key={entry.id} className={`${styles.line} ${styles[entry.level.toLowerCase()]}`}>
                <span className={styles.time}>{entry.time}</span>
                <span className={styles.level}>[{entry.level}]:</span>
                {entry.message ? <span className={styles.message}>{entry.message}</span> : null}
              </div>
            ))}
          </div>
        )}
      </Drawer>

      <LogFileMenu
        open={open && menuOpen}
        active={activeFile}
        onSelect={selectFile}
        onClose={() => setMenuOpen(false)}
        anchor={moreRef.current}
      />
    </>
  );
}
