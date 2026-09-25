import { CheckOutlined } from '@ant-design/icons';
import { useEffect, useRef } from 'react';

import { useLogs, type LogFileName } from '@/state/logs';

import styles from './index.module.less';

interface LogFileMenuProps {
  open: boolean;
  active: LogFileName;
  onSelect: (file: LogFileName) => void;
  onClose: () => void;
  /** 锚点元素，用于把菜单定位到"更多"按钮下方 */
  anchor: HTMLElement | null;
  /** 为 true 时菜单宽度与锚点所在行对齐，而不是由最长文件名决定 */
  matchAnchorWidth?: boolean;
}

/**
 * 日志文件选择菜单。
 *
 * 点击标题栏的"更多"按钮弹出，选中项显示为蓝色 + 右侧对勾，
 * 点击遮罩或选中任意一项后关闭。
 *
 * 文件清单来自 `useLogs().files`，即 run 目录下真实存在的 *.log，
 * 不再硬编码，避免列表与磁盘内容不一致。
 */
export function LogFileMenu({
  open,
  active,
  onSelect,
  onClose,
  anchor,
  matchAnchorWidth,
}: LogFileMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { files, filesLoading } = useLogs();

  // 打开时按锚点位置定位；窗口尺寸变化就重新计算，避免菜单停留在错误位置
  useEffect(() => {
    if (!open) {
      return;
    }

    const reposition = () => {
      const menu = menuRef.current;
      if (!menu || !anchor) {
        return;
      }

      const rect = anchor.getBoundingClientRect();
      // 菜单右边缘与按钮右边缘对齐，顶边贴在按钮下方
      menu.style.top = `${rect.bottom + 8}px`;
      menu.style.right = `${Math.max(12, window.innerWidth - rect.right)}px`;
      // 对齐选项行时由 CSS 撑满宽度，否则保持收缩到内容宽度
      menu.style.width = matchAnchorWidth ? `${rect.width}px` : '';
    };

    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);

    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, anchor, matchAnchorWidth]);

  if (!open) {
    return null;
  }

  return (
    <>
      {/* 遮罩：点击任意处关闭，同时把后方页面压暗 */}
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.menu} ref={menuRef} role="menu">
        {files.length === 0 ? (
          <div className={styles.empty}>
            {filesLoading ? '正在读取日志列表…' : '暂无可查看的日志'}
          </div>
        ) : (
          files.map((file) => {
            const selected = file.name === active;

            return (
              <button
                key={file.name}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={`${styles.item} ${selected ? styles.active : ''}`}
                onClick={() => {
                  onSelect(file.name);
                  onClose();
                }}
              >
                <span className={styles.name}>{file.name}</span>
                {selected ? <CheckOutlined className={styles.check} /> : null}
              </button>
            );
          })
        )}
      </div>
    </>
  );
}
