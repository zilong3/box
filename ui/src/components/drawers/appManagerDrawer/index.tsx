import { CheckOutlined, CloseCircleFilled, SaveOutlined, SearchOutlined, SortAscendingOutlined } from '@ant-design/icons';
import { useMemo, useRef, useState } from 'react';

import { Drawer } from '@/components/ui/drawer';
import { IconButton } from '@/components/ui/iconButton';
import { toast } from '@/bridge';
import { useApps, type AppMode } from '@/state/apps';
import { useDrawer } from '@/state/drawer';

import styles from './index.module.less';

/** 顶部分段按钮：黑名单 / 白名单 / 核心 */
const MODES: { key: AppMode; label: string }[] = [
  { key: 'blacklist', label: '黑名单' },
  { key: 'whitelist', label: '白名单' },
  { key: 'core', label: '核心' },
];

/** 每个模式的空状态文案 */
const EMPTY_TEXT: Record<AppMode, string> = {
  blacklist: '黑名单里还没有应用，勾选后这些应用会走代理',
  whitelist: '白名单里还没有应用，勾选后这些应用会直连',
  core: '核心模式下勾选框不可修改，请到黑名单或白名单里调整',
};

/**
 * 应用管理抽屉。
 *
 * 顶部三档分段按钮切换黑名单 / 白名单 / 核心：
 * 黑名单与白名单是勾选列表；核心模式沿用同一份勾选状态，
 * 但勾选框置灰不可点（避免在核心页误改名单），只用于展示哪些应用已生效。
 * 列表把已选中的应用排在前面，同组内再按名称排序。
 * 截图里的排序、保存按钮放在标题栏右侧，保存只做提示。
 *
 * 搜索框默认隐藏，点标题栏的搜索图标才展开（图标同步高亮），再点一次收起并清空关键字。
 */
export function AppManagerDrawer() {
  const { route, close } = useDrawer();
  const { apps, mode, setMode, toggleApp } = useApps();
  const [query, setQuery] = useState('');
  const [ascending, setAscending] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  // 展开搜索后自动聚焦输入框
  const searchRef = useRef<HTMLInputElement>(null);

  const open = route === 'appManager';

  const toggleSearch = () => {
    if (searchOpen) {
      setSearchOpen(false);
      // 收起时一并清空关键字，否则列表会停在"被隐藏的过滤条件"下
      setQuery('');
      return;
    }
    setSearchOpen(true);
    // 输入框这一帧还没挂载，等渲染完再聚焦
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  const keyword = query.trim().toLowerCase();
  const visible = useMemo(() => {
    const matched = keyword
      ? apps.filter(
          (app) =>
            app.name.toLowerCase().includes(keyword) ||
            app.packageName.toLowerCase().includes(keyword),
        )
      : apps;

    // 三种模式共用同一份勾选状态，已勾选的统一排在前面
    return [...matched].sort((a, b) => {
      const picked = Number(b.enabled) - Number(a.enabled);
      if (picked !== 0) {
        return picked;
      }
      // 同一组内再按名称排序，方向由标题栏的排序按钮决定
      return ascending ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    });
  }, [apps, ascending, keyword]);

  return (
    <Drawer
      open={open}
      onClose={close}
      title="应用管理"
      actions={
        <>
          <IconButton
            icon={<SearchOutlined />}
            label={searchOpen ? '收起搜索' : '展开搜索'}
            active={searchOpen}
            onClick={toggleSearch}
          />
          <IconButton
            icon={<SortAscendingOutlined />}
            label="按名称排序"
            onClick={() => setAscending((value) => !value)}
          />
          <IconButton
            icon={<SaveOutlined />}
            label="保存"
            onClick={() => toast('应用规则已保存（预览模式）')}
          />
        </>
      }
    >
      <div className={styles.body}>
        {/* 搜索框默认隐藏，点击标题栏的搜索图标后显示（图标同时高亮） */}
        {searchOpen ? (
          <div className={styles.searchBar}>
            <SearchOutlined className={styles.searchIcon} />
            <input
              ref={searchRef}
              className={styles.searchInput}
              value={query}
              placeholder="搜索应用名或包名"
              onChange={(event) => setQuery(event.target.value)}
            />
            {query ? (
              <button
                type="button"
                className={styles.searchClear}
                aria-label="清空搜索"
                onClick={() => setQuery('')}
              >
                <CloseCircleFilled />
              </button>
            ) : null}
          </div>
        ) : null}

        <div className={styles.segment}>
          {MODES.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`${styles.segmentItem} ${mode === item.key ? styles.segmentActive : ''}`}
              onClick={() => setMode(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className={styles.empty}>{EMPTY_TEXT[mode]}</div>
        ) : (
          <div className={styles.list}>
            {visible.map((app) => (
              <div key={app.packageName} className={styles.row}>
                <span className={styles.icon} aria-hidden>
                  {app.name.slice(0, 1)}
                </span>

                <span className={styles.info}>
                  <span className={styles.name}>{app.name}</span>
                  <span className={styles.package}>{`0:${app.packageName}`}</span>
                </span>

                {/*
                  核心模式下勾选框只做展示：置灰且不可点击，
                  表示这里的勾选状态由黑/白名单决定，不随核心模式改变。
                */}
                <button
                  type="button"
                  className={`${styles.check} ${app.enabled ? styles.checkOn : ''} ${
                    mode === 'core' ? styles.checkDisabled : ''
                  }`}
                  aria-label={`${app.enabled ? '已选中' : '未选中'} ${app.name}`}
                  aria-pressed={app.enabled}
                  disabled={mode === 'core'}
                  onClick={() => toggleApp(app.packageName)}
                >
                  {app.enabled ? <CheckOutlined /> : null}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
}
