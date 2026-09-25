import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { panel, type LogFileInfo } from '@/bridge';

/** 日志级别，决定着色 */
export type LogLevel = 'Info' | 'Warning' | 'Error' | 'Debug';

export interface LogEntry {
  id: number;
  time: string;
  level: LogLevel;
  message: string;
}

/**
 * 日志文件清单**不再硬编码**。
 *
 * 由 `panel.listLogFiles()` 扫描 `/data/adb/box/run/*.log` 实时得出
 * （脚本侧 `list_log_files`），这样底层核心改名、新增日志、或 `.old.log`
 * 轮转都不会让面板的列表和磁盘上的真实文件对不上。
 */
export type LogFileName = string;

/** 文件被删除（或首次加载时该文件已不存在）后，回退到这个文件 */
const FALLBACK_FILE = 'runs.log';

interface LogContextValue {
  /** 当前选中的日志文件，尚未加载完成时为空串 */
  activeFile: string;
  selectFile: (file: string) => void;
  /** run 目录下真实存在的日志文件 */
  files: LogFileInfo[];
  filesLoading: boolean;
  /** 当前文件的日志内容 */
  logs: LogEntry[];
  /** 文件总行数，用于提示是否被截断 */
  totalLines: number;
  clear: () => void;
  refresh: () => void;
  refreshing: boolean;
  /** 上一次读取失败的原因，成功时清空 */
  error: string | null;
}

let seq = 0;

function makeEntry(time: string, level: LogLevel, message: string): LogEntry {
  return { id: (seq += 1), time, level, message };
}

/**
 * 解析一行日志。
 *
 * 脚本侧的 `log()` 落盘格式是 `2026-09-24 21:06:03 [Info]: 正文`，
 * 这里把它拆成时间 / 级别 / 正文三段；不匹配的行按 Debug 整行显示，
 * 保证任何输出都不会被吃掉（排查问题时最忌讳丢行）。
 */
function parseLine(line: string): LogEntry | null {
  if (!line.trim()) {
    return null;
  }

  const matched = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+\[(\w+)\]:\s?(.*)$/.exec(line);

  if (!matched) {
    return makeEntry('', 'Debug', line);
  }

  const [, time, rawLevel, message] = matched;

  switch (rawLevel) {
    case 'Error':
      return makeEntry(time, 'Error', message);
    case 'Warn':
    case 'Warning':
      return makeEntry(time, 'Warning', message);
    case 'Debug':
      return makeEntry(time, 'Debug', message);
    default:
      return makeEntry(time, 'Info', message);
  }
}

const LogContext = createContext<LogContextValue | null>(null);

/**
 * 日志状态。
 *
 * 内容来自 `panel.tailLog()`，即 run 目录下的真实日志文件；
 * 浏览器预览模式下 api 层返回空字符串，页面显示"暂无日志"空状态。
 */
export function LogProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<LogFileInfo[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [activeFile, setActiveFile] = useState<string>('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalLines, setTotalLines] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 读一次 run 目录，拿到真实存在的日志文件清单。
   *
   * 返回解析出的清单（而不是只 setState），调用方据此决定选中哪个文件——
   * 这样「拿清单」和「读内容」是一条顺序的 async 链，不依赖 state 在
   * 下一个 render 里是否已经更新，也就不会出现「清单到了但 activeFile
   * 还是空串、于是直接跳过读取」的竞态。
   */
  const loadFiles = useCallback(async (): Promise<LogFileInfo[]> => {
    try {
      const list = await panel.listLogFiles();

      setFiles(list);
      setActiveFile((current) => {
        if (current && list.some((file) => file.name === current)) {
          return current;
        }

        const preferred = list.find((file) => file.name === FALLBACK_FILE) ?? list[0];

        return preferred ? preferred.name : '';
      });

      return list;
    } catch (reason) {
      setFiles([]);
      setError(reason instanceof Error ? reason.message : String(reason));

      return [];
    } finally {
      setFilesLoading(false);
    }
  }, []);

  /**
   * 读一个文件的末尾内容。
   *
   * 用递增的请求号做「只认最后一次」：切文件/连点刷新时，先发的请求即使晚回来
   * 也会因为号小而被丢弃，不会把后发的结果覆盖掉。
   */
  const requestSeq = useRef(0);

  const load = useCallback(async (file: string) => {
    const seq = (requestSeq.current += 1);

    setRefreshing(true);

    try {
      const result = await panel.tailLog(file, 300);

      if (seq !== requestSeq.current) {
        return;
      }

      setLogs(
        result.content
          .split('\n')
          .map(parseLine)
          .filter((entry): entry is LogEntry => entry !== null),
      );
      setTotalLines(result.total);
      setError(null);
    } catch (reason) {
      if (seq !== requestSeq.current) {
        return;
      }

      setLogs([]);
      setTotalLines(0);
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (seq === requestSeq.current) {
        setRefreshing(false);
      }
    }
  }, []);

  /**
   * 首屏：拿清单 → 读被选中的那个文件。
   *
   * 两步串在同一个 async 函数里，用 loadFiles 的**返回值**决定读哪个文件，
   * 而不是读 activeFile 这个 state（它在本次 render 里还是旧值）。
   *
   * StrictMode 下 mount effect 会执行两次：两次都会走完各自完整的
   * 「清单 → 内容」链路，requestSeq 保证只有后一次的结果会落地。
   */
  useEffect(() => {
    let alive = true;

    void (async () => {
      const list = await loadFiles();

      if (!alive) {
        return;
      }

      const target =
        list.find((file) => file.name === FALLBACK_FILE)?.name ?? list[0]?.name ?? '';

      if (!target) {
        // 目录里一个 .log 都没有：明确置空，别停在 loading 上
        setLogs([]);
        setTotalLines(0);
        setRefreshing(false);
        return;
      }

      await load(target);
    })();

    return () => {
      alive = false;
    };
  }, [loadFiles, load]);

  /** 手动刷新：重列文件 + 重读当前文件 */
  const refresh = useCallback(() => {
    void (async () => {
      const list = await loadFiles();
      const target =
        list.find((file) => file.name === activeFile)?.name ??
        list.find((file) => file.name === FALLBACK_FILE)?.name ??
        list[0]?.name ??
        '';

      if (!target) {
        setLogs([]);
        setTotalLines(0);
        setRefreshing(false);
        return;
      }

      await load(target);
    })();
  }, [activeFile, loadFiles, load]);

  const selectFile = useCallback(
    (file: LogFileName) => {
      setActiveFile(file);
      // 切文件后立刻读一次，不用再手动点刷新
      void load(file);
    },
    [load],
  );

  const clear = useCallback(() => {
    if (!activeFile) {
      return;
    }

    const target = activeFile;

    void (async () => {
      try {
        await panel.clearLog(target);
        // 清空后重读一次：文件仍在，只是内容为空，
        // 走 load 能把 totalLines 归零并清掉 error。
        await load(target);
        // 文件大小/修改时间变了，顺手刷新清单
        await loadFiles();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    })();
  }, [activeFile, loadFiles, load]);

  const value = useMemo<LogContextValue>(
    () => ({
      activeFile,
      selectFile,
      files,
      filesLoading,
      logs,
      totalLines,
      clear,
      refresh,
      refreshing,
      error,
    }),
    [
      activeFile,
      selectFile,
      files,
      filesLoading,
      logs,
      totalLines,
      clear,
      refresh,
      refreshing,
      error,
    ],
  );

  return <LogContext.Provider value={value}>{children}</LogContext.Provider>;
}

export function useLogs(): LogContextValue {
  const context = useContext(LogContext);

  if (!context) {
    throw new Error('useLogs 必须在 <LogProvider> 内部使用');
  }

  return context;
}
