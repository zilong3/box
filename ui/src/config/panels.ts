/**
 * 外部面板地址表。
 *
 * Sub-Store 与 WebUI 都是"整屏内嵌一个外部页面"，
 * 这里集中放地址，避免散落在页面组件里。
 */

/** Sub-Store 订阅管理面板 */
export const SUB_STORE_URL = 'https://www.zilong3.top:8003';

/** WebUI 里可切换的面板 */
export interface WebuiPanel {
  key: string;
  /** 面板名，显示在切换菜单与顶栏标题 */
  name: string;
  /** 面板地址，显示在切换菜单的副标题 */
  url: string;
  /** 是否为本机面板：走固定回环地址，图标与外部面板区分开 */
  local?: boolean;
}

/**
 * 面板列表顺序与截图一致：本地面板在最前，其次两个公共面板。
 * 已按要求去掉 MetaCubeXD，也不提供"自定义面板"。
 */
export const WEBUI_PANELS: WebuiPanel[] = [
  {
    key: 'local',
    name: '本地面板',
    url: 'http://127.0.0.1:7895/ui',
    local: true,
  },
  {
    key: 'zashboard',
    name: 'Zashboard',
    url: 'https://board.zash.run.place',
  },
  {
    key: 'sing-box',
    name: 'Sing-Box',
    url: 'https://sing-box-dashboard.sagernet.org',
  },
];

/** 默认面板：列表第一项，即本地面板 */
export const DEFAULT_WEBUI_PANEL = WEBUI_PANELS[0];
