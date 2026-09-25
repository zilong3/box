import { CheckOutlined } from '@ant-design/icons';
import { Switch } from 'antd';
import { useEffect, useRef, useState, type AriaAttributes, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';

import styles from './index.module.less';

interface FormRowProps {
  label: ReactNode;
  /** 右侧自定义控件 */
  extra?: ReactNode;
  onClick?: () => void;
  /** 需要按行定位弹出菜单时，把 ref 透传给行容器 */
  rowRef?: Ref<HTMLDivElement>;
  'aria-haspopup'?: AriaAttributes['aria-haspopup'];
  'aria-expanded'?: boolean;
}

/** 设置类页面的一行：左侧标签 + 右侧控件（开关 / 下拉 / 按钮） */
export function FormRow({
  label,
  extra,
  onClick,
  rowRef,
  'aria-haspopup': ariaHasPopup,
  'aria-expanded': ariaExpanded,
}: FormRowProps) {
  // 只有可点击的行才进入 Tab 序列，键盘也能唤起下拉菜单
  const interactive = Boolean(onClick);

  return (
    <div
      className={`${styles.row} ${interactive ? styles.clickable : ''}`}
      onClick={onClick}
      ref={rowRef}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-haspopup={ariaHasPopup}
      aria-expanded={ariaExpanded}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <span className={styles.label}>{label}</span>
      {extra ? <span className={styles.extra}>{extra}</span> : null}
    </div>
  );
}

interface SwitchRowProps {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** 带开关的行，设置页大量使用 */
export function SwitchRow({ label, checked, onChange }: SwitchRowProps) {
  return (
    <FormRow
      label={label}
      extra={
        <Switch
          checked={checked}
          onChange={onChange}
          // 阻止冒泡，避免点到 Switch 时又触发行本身的 onClick
          onClick={(_checked, event) => event.stopPropagation()}
        />
      }
    />
  );
}

interface SelectRowProps {
  label: ReactNode;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

/** 弹出菜单优先匹配的目标宽度（对齐截图里约 280pt 的宽度） */
const MENU_TARGET_WIDTH = 280;
/** 菜单与屏幕边缘的最小间距 */
const MENU_MARGIN = 16;
/** 菜单最多占据视口高度的比例，超出后内部滚动 */
const MENU_MAX_HEIGHT_RATIO = 0.6;

interface MenuPosition {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
}

/**
 * 计算弹出菜单的位置：水平方向与选项行左右对齐，垂直方向优先向下展开，
 * 下方空间不足时（例如遮住底部 Tab 栏）改为向上展开，并按剩余空间限制高度。
 */
function resolveMenuPosition(row: HTMLElement): MenuPosition {
  const rect = row.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // 菜单比选项行略宽，但不能顶到屏幕边缘；屏幕过窄时退化为与选项行等宽
  const width = Math.min(
    Math.max(rect.width, MENU_TARGET_WIDTH),
    viewportWidth - MENU_MARGIN * 2,
  );
  const left = Math.min(
    Math.max(MENU_MARGIN, rect.left),
    Math.max(MENU_MARGIN, viewportWidth - MENU_MARGIN - width),
  );

  const gap = 8;
  const innerHeight = viewportHeight - MENU_MARGIN * 2;
  const spaceBelow = viewportHeight - rect.bottom - gap - MENU_MARGIN;
  const spaceAbove = rect.top - gap - MENU_MARGIN;
  const anchoredHeight = Math.min(innerHeight, MENU_MAX_HEIGHT_RATIO * viewportHeight);

  if (spaceBelow >= anchoredHeight || spaceBelow >= spaceAbove) {
    return {
      top: rect.bottom + gap,
      left,
      width,
      maxHeight: Math.max(120, Math.min(anchoredHeight, spaceBelow)),
    };
  }

  return {
    bottom: viewportHeight - rect.top + gap,
    left,
    width,
    maxHeight: Math.max(120, Math.min(anchoredHeight, spaceAbove)),
  };
}

/**
 * 带下拉选择的行，右侧显示当前值 + 上下箭头。
 *
 * 点击整行弹出选项菜单（选中项为蓝色 + 对勾），与日志文件菜单保持一致的观感。
 */
export function SelectRow({ label, value, options, onChange }: SelectRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  // 打开期间跟随选项行定位，窗口尺寸或页面滚动变化时重新计算
  useEffect(() => {
    if (!open) {
      return;
    }

    const reposition = () => {
      const row = rowRef.current;
      if (row) {
        setPosition(resolveMenuPosition(row));
      }
    };

    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);

    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  // Esc 关闭，避免菜单只能靠点遮罩退出
  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  /** 关闭前把焦点还给选项行，维持键盘可达性 */
  const close = () => {
    setOpen(false);
    rowRef.current?.focus();
  };

  return (
    <>
      <FormRow
        label={label}
        rowRef={rowRef}
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="menu"
        aria-expanded={open}
        extra={
          <span className={styles.selectValue}>
            <span className={styles.selectText}>{value}</span>
            <span className={styles.chevron} aria-hidden />
          </span>
        }
      />

      {/* 菜单挂在 body 下，避免被抽屉的滚动容器裁掉；首帧坐标未算好时不渲染 */}
      {open && position
        ? createPortal(
            <>
              <div className={styles.menuBackdrop} onClick={close} />
              <div
                className={styles.menu}
                ref={menuRef}
                role="menu"
                style={{
                  top: position.top,
                  bottom: position.bottom,
                  left: position.left,
                  width: position.width,
                  maxHeight: position.maxHeight,
                }}
              >
                {options.map((option) => {
                  const selected = option === value;

                  return (
                    <button
                      key={option}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selected}
                      className={`${styles.menuItem} ${selected ? styles.menuItemActive : ''}`}
                      onClick={() => {
                        onChange(option);
                        setOpen(false);
                      }}
                    >
                      <span className={styles.menuName}>{option}</span>
                      {selected ? <CheckOutlined className={styles.menuCheck} /> : null}
                    </button>
                  );
                })}
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
