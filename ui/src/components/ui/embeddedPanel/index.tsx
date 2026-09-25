import { useCallback, useRef, type ReactNode } from 'react';
import { ReloadOutlined } from '@ant-design/icons';

import { IconButton } from '@/components/ui/iconButton';

import styles from './index.module.less';

interface EmbeddedPanelProps {
  /** 是否显示。用显隐而非条件渲染，返回后 iframe 不重载，面板里翻到哪就停在哪 */
  open: boolean;
  /** 面板地址；变化时 iframe 会自动导航到新地址 */
  url: string;
  /** 顶栏标题 */
  title: string;
  onClose: () => void;
  /** 顶栏标题右侧的额外按钮（例如"切换面板"），刷新按钮由本组件提供 */
  actions?: ReactNode;
}

/**
 * 整屏内嵌外部页面的通用外壳。
 *
 * Sub-Store 与 WebUI 共用：顶部一条返回栏，下面 iframe 铺满，打开时盖住底部 Tab 栏。
 *
 * 几个关键点：
 * - 容器 fixed + z-index 高于底栏（底栏是 fixed z-index 20），否则面板底部会被底栏压住；
 * - 刷新只能重新赋 src，跨域下拿不到 contentWindow，调不了 location.reload()；
 * - 用 hidden 显隐，切走再回来不会重新加载。
 */
export function EmbeddedPanel({ open, url, title, onClose, actions }: EmbeddedPanelProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  /** 重新赋当前 src 让浏览器重新加载，顺便清掉面板内的当前路由 */
  const reload = useCallback(() => {
    const frame = frameRef.current;

    if (frame) {
      frame.src = url;
    }
  }, [url]);

  return (
    <div className={styles.embed} hidden={!open}>
      <div className={styles.header}>
        <button type="button" className={styles.back} onClick={onClose} aria-label="返回">
          ←
        </button>
        <span className={styles.title}>{title}</span>
        {actions}
        <IconButton icon={<ReloadOutlined />} label="刷新" onClick={reload} />
      </div>
      <iframe
        ref={frameRef}
        className={styles.frame}
        src={url}
        title={title}
        // 面板自身要跳转、要读剪贴板，只收窄 referrer，不加 sandbox 免得功能被拦
        referrerPolicy="no-referrer"
        // local-network-access：面板是公网来源，却要访问 127.0.0.1 上的代理核心接口。
        // Chrome 142+ 的 LNA 规定子框架访问回环/局域网必须由父页面显式委托，
        // 否则 fetch 会被拦掉（顶层标签页直接打开同一面板则不受限，所以这里必须补上）。
        allow="clipboard-read; clipboard-write; local-network-access"
      />
    </div>
  );
}
