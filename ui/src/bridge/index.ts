/**
 * 桥接层唯一入口。
 *
 * 业务代码（组件 / state）从这里取东西，**不要**直接 import `api` 或 `ksu`：
 *
 *     import { panel, toast } from '@/bridge';
 *     const status = await panel.queryServiceStatus();
 *
 * 分层只有两个文件：
 *
 *     ksu.ts   机制层：window.ksu 封装（`exec` 只给 api.ts 用）
 *     api.ts   翻译层：白名单动作 + 参数转义 + `KSU_*` 输出解析
 *
 * 面板不自己执行任何命令：所有能力都收在 `/data/adb/box/scripts/box.webui`
 * 里的一张白名单上，由它再转发给 box.service / box.iptables / box.tool。
 */
export { panel, toast } from '@/bridge/api';

export {
  // 界面能力
  enableEdgeToEdge,
  fullScreen,
  isKsuAvailable,
  moduleInfo,
  // 常量
  BOX_DIR,
  CORE_FALLBACK,
  CORES,
  MODULE_DIR,
  NETWORK_MODES,
  PROXY_MODES,
  WEBUI_ACTIONS,
  WEBUI_SCRIPT,
  // 类型
  type ActionOutcome,
  type CoreName,
  type LogFileInfo,
  type LogTailResult,
  type NetworkMode,
  type PanelApi,
  type ProxyMode,
  type ServiceCommand,
  type ServiceStatus,
  type VersionInfo,
  type WebuiAction,
} from '@/bridge/api';
