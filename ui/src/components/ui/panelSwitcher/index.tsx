import { CheckOutlined, GlobalOutlined, HomeOutlined } from '@ant-design/icons';

import { WEBUI_PANELS, type WebuiPanel } from '@/config/panels';

import styles from './index.module.less';

interface PanelSwitcherProps {
  open: boolean;
  /** 当前选中的面板 key */
  active: string;
  onSelect: (panel: WebuiPanel) => void;
  onClose: () => void;
}

/**
 * WebUI 面板切换弹层。
 *
 * 从底部升起，样式对齐参考图：每行左侧图标 + 面板名 + 地址，选中项右侧一个蓝色对勾。
 * 没有"自定义面板/新增面板"，也不提供删除。
 */
export function PanelSwitcher({ open, active, onSelect, onClose }: PanelSwitcherProps) {
  if (!open) {
    return null;
  }

  return (
    <>
      {/* 遮罩：点击任意处关闭，并把后方页面的顶栏压暗 */}
      <div className={styles.backdrop} onClick={onClose} />

      <div className={styles.sheet} role="dialog" aria-label="切换面板">
        {/* 顶部小横条，和参考图一致 */}
        <div className={styles.handle} />
        <div className={styles.heading}>切换面板</div>

        <div className={styles.group}>
          {WEBUI_PANELS.map((panel) => {
            const selected = panel.key === active;

            return (
              <button
                key={panel.key}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={styles.item}
                onClick={() => {
                  onSelect(panel);
                  onClose();
                }}
              >
                <span className={styles.icon}>
                  {panel.local ? <HomeOutlined /> : <GlobalOutlined />}
                </span>
                <span className={styles.text}>
                  <span className={styles.name}>{panel.name}</span>
                  <span className={styles.url}>{panel.url}</span>
                </span>
                {selected ? <CheckOutlined className={styles.check} /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
