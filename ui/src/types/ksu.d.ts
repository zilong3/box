/**
 * 管理器注入到 WebView 的原生桥接对象（`window.ksu`）。
 *
 * 这里只做类型声明，实际调用统一走 `@/bridge`，不要在业务代码里直接使用 window.ksu。
 * 字段签名参考 kernelsu npm 包与 KernelSU 文档：
 * https://kernelsu.org/zh_CN/guide/module-webui.html
 */
interface KsuBridge {
  /** 以 root 执行命令；结果通过 `${callbackFuncName}(errno, stdout, stderr)` 回调返回 */
  exec(command: string, options: string, callbackFuncName: string): void;
  /** 启动进程，返回进程 id；stdout/stderr 通过回调名回传 */
  spawn(command: string, args: string, options: string, callbackFuncName: string): number;
  toast(message: string): void;
  fullScreen(isFullScreen: boolean): void;
  enableEdgeToEdge(enable: boolean): void;
  moduleInfo(): string;
  listPackages(type: string): string[];
  getPackagesInfo(packages: string): string;
  exit(): void;
}

interface Window {
  ksu?: KsuBridge;
}
