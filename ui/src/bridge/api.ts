/**
 * 模块脚本桥接：面板与内核之间的**唯一**通道。
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 只用记住两件事
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   1. 业务代码（组件 / state）**只 import `panel`**，调用它的具名方法；
 *   2. 面板不自己执行任何命令 —— 所有能力都在
 *      `/data/adb/box/scripts/box.webui` 里，由它再转发给
 *      box.service / box.iptables / box.tool。
 *
 * 换句话说：本文件是「面板 → box.webui」的翻译层，只做三件事：
 *
 *     拼白名单动作  →  runCommand()  →  把 `KSU_*` 输出解析成对象
 *
 * 想加功能时的固定三步：
 *   1. 在 `box/scripts/box.webui` 的 BOX_WEBUI_ACTIONS 加一个 action；
 *   2. 在本文件加一个同名方法；
 *   3. 组件调 `panel.xxx()`。
 *
 * 为什么不给业务代码 `exec`：
 *   `ksu.exec` 是 root 权限的任意字符串执行入口。命令一旦散落在组件里，
 *   任何一处字符串拼接（尤其是把界面上的文本拼进命令）都是提权口子。
 *   收口到这里后，能执行的命令集合是一张固定白名单，参数逐个引号包裹。
 *
 * 关于输出协议：脚本把结构化结果写成 `KSU_<TAG>|字段|字段...` 单行
 * （见 `box.webui` 的 emit_record），本文件负责解析。字段里的 `|` 在脚本侧
 * 已被替换成空格，所以可以直接按 `|` 切分。
 */
import {
  isKsuAvailable,
  runCommand,
  runCommandAsync,
  toast as nativeToast,
  type ExecResult,
} from '@/bridge/ksu';

// ── 常量 ────────────────────────────────────────────────────────────────────

/** 模块工作目录（与 customize.sh / settings.ini 的约定一致） */
export const BOX_DIR = '/data/adb/box';
/** 模块安装目录，`settings.ini` 里的 moddir 同样是这个路径 */
export const MODULE_DIR = '/data/adb/modules/box_for_root';

/** 面板唯一入口脚本：业务代码永远不直接调用它，只通过 panel 的方法 */
export const WEBUI_SCRIPT = `${BOX_DIR}/scripts/box.webui`;

/** 支持的核心（与 settings.ini 的 bin_list 一致） */
export const CORES = ['mihomo', 'sing-box', 'xray', 'v2fly', 'hysteria'] as const;
export type CoreName = (typeof CORES)[number];

/** 网络模式（settings.ini 的 network_mode） */
export const NETWORK_MODES = ['tun', 'tproxy', 'redirect', 'mixed', 'enhance'] as const;
export type NetworkMode = (typeof NETWORK_MODES)[number];

/** 代理模式（settings.ini 的 proxy_mode） */
export const PROXY_MODES = ['blacklist', 'whitelist', 'core'] as const;
export type ProxyMode = (typeof PROXY_MODES)[number];

/** 各核心的配置文件兜底名，只在探测不到 settings.ini 时用 */
export const CORE_FALLBACK: Record<CoreName, string> = {
  mihomo: 'config.yaml',
  'sing-box': 'config.json',
  xray: 'config.json',
  v2fly: 'config.json',
  hysteria: 'config.yaml',
};

/**
 * 面板可下发的一级动作，与 `box.webui` 的 BOX_WEBUI_ACTIONS 一一对应。
 *
 * 这是一份**白名单**：类型上就杜绝了传任意子命令的可能。
 */
export const WEBUI_ACTIONS = [
  'status',
  'start',
  'stop',
  'restart',
  'reload',
  'logs',
  'tail',
  'clear',
  'version',
  'check',
] as const;

export type WebuiAction = (typeof WEBUI_ACTIONS)[number];

/** 面板可下发的服务操作 */
export type ServiceCommand = 'start' | 'stop' | 'restart' | 'reload';

// ── 结果类型 ────────────────────────────────────────────────────────────────

/** 从内核侧读回的服务状态 */
export interface ServiceStatus {
  /** running: 核心进程存活；stopped: 核心未运行；unknown: 读取失败 */
  state: 'running' | 'stopped' | 'unknown';
  pid?: number;
  /** 核心进程已运行秒数 */
  uptimeSeconds?: number;
  core?: CoreName;
  networkMode?: NetworkMode;
  proxyMode?: ProxyMode;
  /** 当前核心里跑着的配置文件路径 */
  configPath?: string;
  /** 核心二进制版本，取不到则没有 */
  version?: string;
  /** 探测命令本身的错误信息，非空表示这次读取不可信 */
  error?: string;
}

/** 模块与核心的版本信息 */
export interface VersionInfo {
  moduleVersion?: string;
  core?: CoreName;
  coreVersion?: string;
  networkMode?: NetworkMode;
  proxyMode?: ProxyMode;
  ipv6?: boolean;
}

/** run 目录下的一个日志文件 */
export interface LogFileInfo {
  name: string;
  size: number;
  /** 最后修改时间（秒级 Unix 时间戳） */
  modifiedAt: number;
}

/** 一次日志读取的结果 */
export interface LogTailResult {
  name: string;
  /** 本次实际读取的行数上限 */
  lines: number;
  /** 文件当前总行数 */
  total: number;
  /** 正文（已剥离 ANSI 颜色码） */
  content: string;
}

/** 一次动作的执行结果 */
export interface ActionOutcome {
  errno: number;
  stdout: string;
  stderr: string;
}

// ── 解析小工具 ──────────────────────────────────────────────────────────────

/**
 * 解析 `KSU_<TAG>|a|b|c` 形式的记录行。
 *
 * 只返回 tag 匹配的行，且校验字段数，避免脚本输出格式变化时把脏数据带进界面。
 */
function parseRecords(stdout: string, tag: string, minFields: number): string[][] {
  const prefix = `KSU_${tag}`;

  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith(`${prefix}|`) || line === prefix)
    .map((line) => line.split('|').slice(1))
    .filter((fields) => fields.length >= minFields);
}

/**
 * 操作失败时，从输出里挑一条能看的行。
 *
 * 顺序很重要：脚本约定**报错写在 stderr**（见 box.webui 的 fail()），
 * stdout 只放结构化数据（`KSU_*` 记录）和日志正文。所以必须先看 stderr，
 * 只有 stderr 空着时才退到 stdout。
 *
 * 之前是把 stderr 和 stdout 拼起来取最后一行，于是 stdout 里随便一句
 * （比如一条 KSU_ 记录或日志尾巴）都会把真正的失败原因顶掉，
 * 界面上就显示出个毫无意义的字符串。
 */
function pickMessage(result: ExecResult): string {
  const clean = (text: string) =>
    text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      // 结构化记录行不是给人看的错误信息，排除掉
      .filter((line) => !line.startsWith('KSU_'))
      .filter((line) => !line.startsWith('用法') && !line.startsWith('usage'));

  const fromStderr = clean(result.stderr);

  if (fromStderr.length > 0) {
    return fromStderr[fromStderr.length - 1];
  }

  const fromStdout = clean(result.stdout);

  return fromStdout[fromStdout.length - 1] ?? '';
}

/** 去掉 ANSI 颜色码（脚本侧可能带色输出，别把转义字符带进界面） */
function stripAnsi(text: string): string {
  /* eslint-disable-next-line no-control-regex */
  return text.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '').trim();
}

/** 拿正整数；拿不到返回 undefined */
function toNumber(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/** 把脚本里的字符串收窄成已知枚举值 */
function toEnum<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

/** 是否处于浏览器预览（没有 ksu 桥接，命令不会真的执行） */
function isPreview(): boolean {
  return !isKsuAvailable();
}

// ── 唯一的命令出口 ──────────────────────────────────────────────────────────

/**
 * 调用 `box.webui` 的一个白名单动作，走**阻塞**的 `ksu.exec`。
 *
 * 这是默认通道，也是行为最有保证的一条：`exec` 会把命令交给 `su -c` 执行，
 * 而且**直接把 stdout 当成返回值**，不会丢内容。
 *
 * 代价：它是同步阻塞的（详见 `ksu.ts` 的 `runCommandAsync`），所以要跑好几秒的
 * 动作必须改用 `callWebuiAsync`，否则界面会卡住 —— 这正是"卡住好几秒然后
 * 突然变成运行中"的根因。
 *
 * 凡是**需要解析 stdout**（logs / tail / version / check）的动作都留在这一条：
 * spawn 那条通道的 stdout 是分块回调的，解析类动作不该为此冒险。
 */
export function callWebui(action: WebuiAction, args: readonly string[] = []): Promise<ExecResult> {
  return runCommand(WEBUI_SCRIPT, [action, ...args]);
}

/**
 * 调用 `box.webui` 的一个白名单动作，走**非阻塞**的 `ksu.spawn`。
 *
 * 只给**耗时长、且不解析 stdout**的动作用（start / stop / restart / reload）：
 * 这些动作要跑好几秒，用 `exec` 会把 WebView 的 JS 线程整个冻住，
 * 连"正在启动"都画不出来、定时器也轮不到执行。
 *
 * 它们的结果由调用方随后再探一次 `status` 得知，所以这里不依赖 stdout。
 */
function callWebuiAsync(action: WebuiAction, args: readonly string[] = []): Promise<ExecResult> {
  return runCommandAsync(WEBUI_SCRIPT, [action, ...args]);
}

// ── 服务状态 ────────────────────────────────────────────────────────────────

/** 预览用的假运行态：启停操作要能"记住"，否则轮询会把停止顶回去 */
let mockRunning = true;

function mockStatus(): ServiceStatus {
  return {
    state: mockRunning ? 'running' : 'stopped',
    pid: mockRunning ? 4242 : undefined,
    uptimeSeconds: mockRunning ? 4 * 3600 + 14 * 60 : 0,
    core: 'sing-box',
    networkMode: 'tproxy',
    proxyMode: 'blacklist',
    configPath: `${BOX_DIR}/sing-box/config.json`,
    version: mockRunning ? 'sing-box version 1.10.1 (preview)' : undefined,
  };
}

/** 解析 `KSU_STATUS|pid|uptime|core|network_mode|proxy_mode|config|version` */
function parseStatusLine(fields: string[]): ServiceStatus {
  const [pid, uptime, core, networkMode, proxyMode, configPath, version] = fields;
  const coreName = toEnum(core, CORES);
  const mode = toEnum(networkMode, NETWORK_MODES);
  const proxy = toEnum(proxyMode, PROXY_MODES);

  if (!pid) {
    return { state: 'stopped', core: coreName, networkMode: mode, proxyMode: proxy, configPath };
  }

  return {
    state: 'running',
    pid: toNumber(pid),
    uptimeSeconds: toNumber(uptime) ?? 0,
    core: coreName,
    networkMode: mode,
    proxyMode: proxy,
    configPath,
    version: stripAnsi(version) || undefined,
  };
}

/**
 * 读取当前服务状态。
 *
 * 探测命令本身失败时返回 `state: 'unknown'`，由上层决定怎么显示
 * （上层会保留上一次的稳定态，避免一次读表失败就把界面从"运行中"翻成"已停止"）。
 */
export async function queryServiceStatus(): Promise<ServiceStatus> {
  if (isPreview()) {
    return mockStatus();
  }

  const result = await callWebui('status');
  const [fields] = parseRecords(result.stdout, 'STATUS', 7);

  if (!fields) {
    return { state: 'unknown', error: pickMessage(result) || `探测命令退出码 ${result.errno}` };
  }

  const parsed = parseStatusLine(fields);

  if (result.errno !== 0 && parsed.state !== 'running') {
    return { ...parsed, error: pickMessage(result) };
  }

  return parsed;
}

/**
 * 下发一次服务操作。
 *
 * 具体的多步编排（先撤规则再停核心之类）都在 `box.webui` 里，
 * 这里只负责选中动作、抛出错误、维护预览态的假数据。
 */
export async function runServiceCommand(command: ServiceCommand): Promise<ActionOutcome> {
  if (isPreview()) {
    // 真机上 start/stop 要跑好几秒（停旧进程、校验配置、拉起核心、重建规则）。
    // 预览态如果瞬间返回，过渡态一闪而过就看不见了，专门调页面时等于白测，
    // 所以这里按动作给一段接近真机的假耗时。
    const mockCostMs = command === 'reload' ? 600 : command === 'stop' ? 1400 : 2600;
    await new Promise((resolve) => window.setTimeout(resolve, mockCostMs));

    // 预览模式没有真进程，把假状态跟着改一下，让按钮语义自洽
    if (command === 'start' || command === 'restart') {
      mockRunning = true;
    } else if (command === 'stop') {
      mockRunning = false;
    }

    return { errno: 0, stdout: '', stderr: '' };
  }

  // 只有启停/重启这类要跑好几秒的动作才走非阻塞通道：
  // 用阻塞的 exec 会把 JS 线程冻住，界面卡住、过渡态画不出来。
  // 它们的结果不靠 stdout，随后再探一次 status 即可。
  const result = await callWebuiAsync(command);

  if (result.errno !== 0) {
    throw new Error(pickMessage(result) || `命令执行失败（退出码 ${result.errno}）`);
  }

  return result;
}

// ── 日志 ────────────────────────────────────────────────────────────────────

/** 预览模式下的假文件清单，让浏览器里能调通「切换文件 + 查看内容」 */
const PREVIEW_LOG_FILES = ['mihomo.log', 'mihomo.old.log', 'net.log', 'runs.log', 'tool.log'];

/** 预览模式下按文件名编一段像样的日志，用来验证解析与着色 */
function mockLogContent(name: string): string {
  const stamp = Date.now();
  const at = (s: number) => new Date(stamp - s * 1000).toLocaleString('sv-SE').replace('T', ' ');

  if (name === 'tool.log') {
    return [
      `${at(90)} [Info]: 执行命令: /data/adb/box/scripts/box.tool check`,
      `${at(88)} [Debug]: /data/adb/box/mihomo/config.yaml 检查通过`,
      `${at(60)} [Info]: ----------------------------------------`,
    ].join('\n');
  }

  return [
    `${at(600)} [Info]: 启动服务: mihomo`,
    `${at(599)} [Debug]: 当前 BusyBox v1.36.1`,
    `${at(560)} [Info]: 代理模式: blacklist`,
    `${at(540)} [Warn]: 权限未变化，跳过递归权限修正`,
    `${at(300)} [Info]: mihomo (PID: 4242) 用户组: root:net_admin, 内存: 82 MB`,
    `${at(120)} [Info]: mihomo 服务正在运行`,
    `${at(30)} [Error]: 示例错误行，用于检查 Error 级别的配色（预览数据）`,
  ].join('\n');
}

/**
 * 列出 run 目录下的日志文件。
 *
 * 清单由脚本扫描 `/data/adb/box/run/*.log` 得出（`box.webui` 的
 * `list_log_files`），前端不维护硬编码列表，避免与磁盘上的真实文件漂移。
 */
export async function listLogFiles(): Promise<LogFileInfo[]> {
  if (isPreview()) {
    const now = Math.floor(Date.now() / 1000);

    return PREVIEW_LOG_FILES.map((name, index) => ({
      name,
      size: 1024 * (index + 1),
      modifiedAt: now - index * 60,
    }));
  }

  const result = await callWebui('logs');

  return parseRecords(result.stdout, 'LOG', 3)
    .map(([name, size, modifiedAt]) => ({
      name,
      size: Number(size) || 0,
      modifiedAt: Number(modifiedAt) || 0,
    }))
    .filter((file) => file.name.length > 0)
    .sort((a, b) => b.modifiedAt - a.modifiedAt);
}

/**
 * 读取某个日志文件的末尾若干行。
 *
 * 脚本侧的输出协议是：
 *
 *     KSU_TAIL|<name>|<lines>|<total>
 *     <正文…>
 *
 * 这里**以 KSU_TAIL 记录行为分界**取正文，而不是盲目丢掉第一行：
 * 脚本的 `log()` 可能往 stdout 写诊断信息，盲丢第一行会把正文吃掉。
 *
 * 空文件是正常情况（记录行 + 空正文），返回 total=0 的空内容，不抛错。
 */
export async function tailLog(name: string, lines = 200): Promise<LogTailResult> {
  if (isPreview()) {
    const all = mockLogContent(name).split('\n');

    return { name, lines, total: all.length, content: all.slice(-lines).join('\n') };
  }

  const result = await callWebui('tail', [name, String(lines)]);

  // 记录行之前的任何噪声都丢弃
  const rawLines = result.stdout.split('\n');
  const headerIndex = rawLines.findIndex((line) => line.trim().startsWith('KSU_TAIL|'));

  if (headerIndex === -1) {
    // 没有记录行：退出码非 0 才算真失败，否则按空内容处理（协议异常不该炸界面）
    if (result.errno !== 0) {
      throw new Error(pickMessage(result) || `读取日志失败（退出码 ${result.errno}）`);
    }

    return { name, lines, total: 0, content: '' };
  }

  const header = rawLines[headerIndex].trim().split('|');
  const total = Number(header[3]) || 0;

  // 正文 = 记录行之后的全部内容；末尾换行折掉，避免界面多出一行空白
  const content = stripAnsi(rawLines.slice(headerIndex + 1).join('\n')).replace(/\n+$/, '');

  // 有记录行说明脚本认可了这次请求，即使 errno 非 0 也按"读到了内容"处理
  return { name: header[1] || name, lines: Number(header[2]) || lines, total, content };
}

/**
 * 清空某个日志文件（保留文件本身，避免脚本侧写日志时目录不存在）。
 *
 * 同样走 `box.webui`：文件名只经过脚本侧那一道校验，
 * 前端不拼路径、不做转义。
 */
export async function clearLog(name: string): Promise<void> {
  if (isPreview()) {
    return;
  }

  const result = await callWebui('clear', [name]);

  if (result.errno !== 0) {
    throw new Error(pickMessage(result) || `清空日志失败（退出码 ${result.errno}）`);
  }
}

// ── 版本与配置 ──────────────────────────────────────────────────────────────

/** 解析 `KSU_VERSION|module|core|coreVersion|networkMode|proxyMode|ipv6` */
export async function queryVersionInfo(): Promise<VersionInfo> {
  if (isPreview()) {
    return {
      moduleVersion: '1.2.8 (preview)',
      core: 'sing-box',
      coreVersion: 'sing-box version 1.10.1 (preview)',
      networkMode: 'tproxy',
      proxyMode: 'blacklist',
      ipv6: true,
    };
  }

  const result = await callWebui('version');
  const [fields] = parseRecords(result.stdout, 'VERSION', 6);

  if (!fields) {
    return {};
  }

  const [moduleVersion, core, coreVersion, networkMode, proxyMode, ipv6] = fields;

  return {
    moduleVersion: moduleVersion || undefined,
    core: toEnum(core, CORES),
    coreVersion: stripAnsi(coreVersion) || undefined,
    networkMode: toEnum(networkMode, NETWORK_MODES),
    proxyMode: toEnum(proxyMode, PROXY_MODES),
    ipv6: ipv6 === 'true',
  };
}

/** 校验当前核心的配置文件；失败时抛出脚本给出的原因 */
export async function checkConfig(): Promise<ActionOutcome> {
  if (isPreview()) {
    return { errno: 0, stdout: '', stderr: '' };
  }

  const result = await callWebui('check');

  if (result.errno !== 0) {
    throw new Error(pickMessage(result) || '配置检查未通过');
  }

  return result;
}

/**
 * 自检：确认脚本侧的白名单与本文件是否一致。
 *
 * 开发时手动调用（控制台 `await panel.selfCheck()`），两边漂移能立刻发现，
 * 而不是等用户点到某个功能才报"未知 action"。
 */
export async function selfCheck(): Promise<{ missing: string[]; extra: string[] }> {
  if (isPreview()) {
    return { missing: [], extra: [] };
  }

  const result = await callWebui('list' as WebuiAction);
  const remote = parseRecords(result.stdout, 'ACTION', 2).map(([name]) => name);
  const local = WEBUI_ACTIONS as readonly string[];

  return {
    // 前端声明了、脚本侧没有 → 调用必然失败
    missing: local.filter((name) => !remote.includes(name)),
    // 脚本侧有、前端没声明 → 只是暂时没接入，不算错误
    extra: remote.filter((name) => !local.includes(name)),
  };
}

// ── 界面小能力（与命令无关，顺带在这里出口，业务只 import 一个模块） ────────

export { enableEdgeToEdge, fullScreen, isKsuAvailable, moduleInfo } from '@/bridge/ksu';

/** 弹出原生 Toast，预览模式下退化为控制台输出 */
export function toast(message: string): void {
  if (isPreview()) {
    console.info(`[bridge:toast] ${message}`);
    return;
  }

  nativeToast(message);
}

// ── 统一出口 ────────────────────────────────────────────────────────────────

/**
 * 面板接口层的统一出口，业务代码用 `panel.xxx()` 调用。
 *
 * 这是**业务代码唯一需要 import 的东西**（外加上面的 toast / moduleInfo 等界面能力）。
 */
export const panel = {
  // 状态
  queryServiceStatus,
  queryVersionInfo,
  // 服务
  runServiceCommand,
  // 日志
  listLogFiles,
  tailLog,
  clearLog,
  // 配置与维护
  checkConfig,
  selfCheck,
};

export type PanelApi = typeof panel;
