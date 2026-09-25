/**
 * KernelSU 原生桥接的机制层。
 *
 * 管理器 App（KernelSU / APatch / MMRL 等）在加载 webroot 页面时会向 WebView 注入
 * `window.ksu` 原生对象，`kernelsu` 这个 npm 包只是对它的一层 Promise 化封装。
 *
 * 本文件只负责"把命令送进内核"这一件事，且**不导出给业务代码**：
 *   - `exec` 由 `@/bridge/api` 独占使用；
 *   - 业务代码一律走 `@/bridge`（`panel` 白名单动作）。
 *
 * 这样做的原因：`ksu.exec` 拿到的是任意字符串，一旦散落在组件里，
 * 每个调用点都要自己保证引号、转义、路径安全，迟早会出问题。
 * 收口到 api 层后，命令文本的构造只有一处。
 */
import {
  enableEdgeToEdge as ksuEnableEdgeToEdge,
  exec as ksuExec,
  fullScreen as ksuFullScreen,
  moduleInfo as ksuModuleInfo,
  spawn as ksuSpawn,
  toast as ksuToast,
} from 'kernelsu';

export interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
}

export interface ExecResult {
  errno: number;
  stdout: string;
  stderr: string;
}

/** 是否运行在支持 WebUI 桥接的 Root 管理器环境中 */
export function isKsuAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.ksu !== 'undefined';
}

/** 原始的原生桥接对象，未注入时为 undefined */
export function getRawBridge(): KsuBridge | undefined {
  return isKsuAvailable() ? window.ksu : undefined;
}

/**
 * 以 root 身份执行 shell 命令。
 *
 * ⚠️ 仅供 `@/bridge/api` 使用，业务代码不要直接调用。
 *
 * 非 KernelSU 环境（例如浏览器预览）下不执行任何命令，直接返回成功空结果。
 */
export async function exec(command: string, options: ExecOptions = {}): Promise<ExecResult> {
  if (!isKsuAvailable()) {
    console.warn(`[bridge] 预览模式，未执行命令：${command}`);
    return { errno: 0, stdout: '', stderr: '' };
  }

  return ksuExec(command, options);
}

/**
 * 把一段文本安全地包成单个 shell 词。
 *
 * 用单引号包裹，文本里已有的单引号按 POSIX 规则写成 `'\''`。
 * 被包裹的内容不会被外层 shell 做任何展开，适合传递路径、参数等不可信输入。
 */
export function shQuote(text: string): string {
  return `'${text.replace(/'/g, `'\\''`)}'`;
}

/**
 * 执行一条命令，argv 逐个转义。
 *
 * `ksu.exec` 最终把命令交给 `su -c` 执行，等于又过一层 shell，
 * 所以这里对**每个参数**单独做引号包裹：参数里的空格、反引号、`$()`、
 * 重定向符都只是普通字符，不会被二次解析。
 *
 * 这是 api 层唯一的命令出口，因此"引号拼接"这件事只在这一处发生。
 */
export function runCommand(program: string, args: readonly string[] = []): Promise<ExecResult> {
  const argv = [program, ...args].map(shQuote).join(' ');

  return exec(argv);
}

/**
 * 与 `runCommand` 同样的引号规则，但**不阻塞 WebView 的 JS 线程**。
 *
 * 为什么必须有这个函数：`ksu.exec` 是同步的 JNI 调用，`kernelsu` 包只是在
 * Promise 构造器里调它——也就是说 `exec()` 这一行要等到 shell 命令**跑完**
 * 才返回。它返回的是 Promise，但调用本身是阻塞的，于是：
 *
 *   - 期间浏览器无法绘制：React 排队的 setState（比如"正在启动"）刷不出去；
 *   - 期间定时器不触发：轮询探测根本轮不到执行。
 *
 * 表现为点一下卡住好几秒，然后"正在启动"和"运行中"几乎同时闪出来。
 *
 * `ksu.spawn` 才是异步的：立刻返回 ChildProcess，stdout/stderr/exit 都走回调。
 * 凡是**耗时可能超过一瞬**的命令（启停核心、重建规则）都必须走这里；
 * `runCommand` 只留给毫秒级的状态探测。
 *
 * 参数按 `spawn(program, args[])` 的**数组形式**交给原生侧，由它自己去做
 * 转义——这与 README 的用法一致，也避免我们拼好一整条命令串再被原生侧
 * 当成单个程序名或二次解析。每个参数里的空格、引号、`$()` 都只是普通字符。
 */
export function runCommandAsync(
  program: string,
  args: readonly string[] = [],
): Promise<ExecResult> {
  if (!isKsuAvailable()) {
    console.warn(`[bridge] 预览模式，未执行命令：${[program, ...args].join(' ')}`);
    return Promise.resolve({ errno: 0, stdout: '', stderr: '' });
  }

  return new Promise((resolve, reject) => {
    const child = ksuSpawn(program, [...args]);
    let stdout = '';
    let stderr = '';
    let settled = false;

    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });

    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });

    child.on('exit', (code: number) => {
      if (settled) {
        return;
      }
      settled = true;
      // 被信号杀掉时 code 可能是 null，统一按非 0 处理，
      // 避免上层把一次异常退出误判成成功
      resolve({ errno: typeof code === 'number' ? code : 1, stdout, stderr });
    });

    child.on('error', (error: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
}

/** 弹出原生 Toast，预览模式下退化为控制台输出 */
export function toast(message: string): void {
  if (!isKsuAvailable()) {
    console.info(`[bridge:toast] ${message}`);
    return;
  }
  ksuToast(message);
}

/** 切换 WebView 全屏 */
export function fullScreen(isFullScreen: boolean): void {
  if (!isKsuAvailable()) {
    return;
  }
  ksuFullScreen(isFullScreen);
}

/** 让 WebView 按安全区（刘海、手势条）留出内边距，需配合 internal/insets.css */
export function enableEdgeToEdge(enable: boolean): void {
  if (!isKsuAvailable()) {
    return;
  }
  ksuEnableEdgeToEdge(enable);
}

/** 读取模块信息（module.prop 的内容），预览模式下返回 undefined */
export function moduleInfo(): string | undefined {
  if (!isKsuAvailable()) {
    return undefined;
  }
  return ksuModuleInfo();
}
