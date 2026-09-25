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
import { App as AntdApp } from 'antd';

import { formatDuration } from '@/utils/format';
import { useTicker } from '@/hooks/useTicker';
import {
  CORE_FALLBACK,
  panel,
  type ServiceCommand,
  type ServiceStatus,
} from '@/bridge';

/** 服务状态机的四个稳定/过渡态 */
export type ServicePhase = 'stopped' | 'starting' | 'running' | 'stopping';

/** 首页快捷操作，与 box.webui 的服务类 action 一一对应 */
export type ServiceAction = 'start' | 'stop' | 'restart' | 'reload';

export interface ServiceSnapshot {
  phase: ServicePhase;
  /** 已持续运行秒数，仅 running 时累加 */
  uptimeSeconds: number;
  /** 代理核心名，例如 sing-box */
  core: string;
  /** 网络模式，例如 tproxy */
  mode: string;
  /** 当前启动配置文件名 */
  configFile: string;
}

interface ServiceContextValue extends ServiceSnapshot {
  /** 是否处于启动/停止等过渡态 */
  busy: boolean;
  /**
   * 是否"正处在过渡态、且命令还没结束"。
   *
   * 这是**横幅与操作条唯一该看的过渡判据**，不要各自去组合 phase 和 busy：
   *
   *   - `phase` 是服务的真实状态，探测到核心起来就会立刻变成 running；
   *   - `busy` 只表示"命令还没返回"，它比 phase 晚一步（start 命令还要跑
   *     iptables 收尾）。
   *
   * 如果操作条用 busy 来画转圈，就会出现"横幅已经运行中、操作条还在转"
   * 的两边不一致。用 transitioning 后，两个组件在同一帧看到同一个值。
   */
  transitioning: boolean;
  running: boolean;
  /** 状态是否已经探测过一次（首屏前显示骨架用） */
  ready: boolean;
  /** 上一次操作/探测失败的原因，成功或重新下发后清空 */
  error: string | null;
  /** 过渡态已持续秒数；非过渡态恒为 0 */
  transitionSeconds: number;
  /** 触发一次状态切换；过渡态下忽略重复点击 */
  dispatch: (action: ServiceAction) => void;
  /** 立即向内核查一次真实状态 */
  refresh: () => void;
}

const STATUS_POLL_MS = 5000;
/**
 * 过渡态期间的探测间隔。
 *
 * 启停命令往往要跑好几秒（停旧进程、校验配置、拉起核心、重建规则），
 * 这段时间内核的状态其实一直在变。如果只在命令返回后探一次，界面就会
 * 先静止好几秒、再"啪"地跳到终态。加密探测让过渡态跟着真实进度走，
 * 核心一活过来界面立刻转"运行中"，不必等 iptables 收尾。
 */
const TRANSITION_POLL_MS = 400;

/** 预览模式下的假时钟与假核心，只用于浏览器里调页面 */
const MOCK_CORE = 'sing-box';
const MOCK_MODE = 'tproxy';

const ServiceContext = createContext<ServiceContextValue | null>(null);

/**
 * 等到"下一帧画完"再继续。
 *
 * 单次 rAF 只保证回调在下一帧绘制**之前**执行，此时 React 排队的更新可能
 * 还没提交、更没画到屏幕上。等两次，才能确保过渡态已经真实可见。
 * 无 rAF 的环境（极老的 WebView）退化成 setTimeout，别让整个流程卡死。
 */
function nextPaint(): Promise<void> {
  if (typeof requestAnimationFrame !== 'function') {
    return new Promise((resolve) => window.setTimeout(resolve, 32));
  }

  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/** 把内核侧的状态映射成界面状态机 */
function phaseFromStatus(status: ServiceStatus, fallback: ServicePhase): ServicePhase {
  if (status.state === 'running') {
    return 'running';
  }

  if (status.state === 'stopped') {
    return 'stopped';
  }

  // 探测失败时保留原状态，避免一次读表失败就把界面从"运行中"翻成"已停止"
  return fallback;
}

/** 从配置路径里取文件名，取不到就按核心给默认值 */
function configFileFromStatus(status: ServiceStatus): string {
  const configPath = status.configPath;

  if (configPath) {
    const name = configPath.split('/').pop();
    if (name) {
      return name;
    }
  }

  return status.core ? CORE_FALLBACK[status.core] : '';
}

/**
 * 服务状态中枢。
 *
 * 状态不再由前端自说自话：每次挂载、每次切换前后都会跑一遍 `@/bridge`
 * 的探测（最终落到 `box.webui status`），拿 `/data/adb/box/run/box.pid`
 * 与核心进程的真实情况说话；探测失败（例如还没安装核心）保留上一次的稳定态，
 * 并把原因放在 `error` 里。
 *
 * 过渡态只在真正下发命令的这段时间里存在，不再用固定时长假装动画。
 */
export function ServiceProvider({ children }: { children: ReactNode }) {
  const { notification } = AntdApp.useApp();

  /**
   * 是否弹提示。
   *
   * 启停/重启**不弹**：这类操作的结果已经由横幅（配色 + 状态词 + 失败原因）
   * 和操作条明确表达，再弹一条"启动完成"是重复信息，而且浮层会挡住内容。
   *
   * 重载保留：它不动核心、界面状态几乎不变（仍显示"运行中"），
   * 用户点完看不出发生了什么，必须给一条明确的反馈。
   */
  const shouldNotify = useCallback((action: ServiceAction) => action === 'reload', []);

  /**
   * 按动作决定要不要提示；不该弹的直接丢弃。
   *
   * 用 notification 而不是 message：message 在这个 antd 版本里只能弹在顶部
   * （placement 被写死），会被摄像头挖孔挡住；notification 原生支持
   * placement: 'bottom'，位置由 <AntdApp> 统一配置，见 app/index.tsx。
   *
   * 这里只给一句标题，不展开描述 —— 重载是个轻动作，一行字足够。
   */
  const notify = useCallback(
    (action: ServiceAction, level: 'success' | 'error', text: string) => {
      if (!shouldNotify(action)) {
        return;
      }
      // title 才是当前推荐的字段（message 已标记 deprecated）。
      //
      // closable: false —— antd 的 notification 默认强制带上右上角的 ×。
      // 这里只是一句 2 秒就自动消失的短反馈，给关闭按钮既多余又占地方。
      // 注意它只能写在调用参数里：全局 NotificationConfig 类型上没有这个字段。
      notification[level]({
        title: text,
        placement: 'bottom',
        duration: 2,
        closable: false,
      });
    },
    [notification, shouldNotify],
  );

  const [phase, setPhase] = useState<ServicePhase>('stopped');
  const [uptimeSeconds, setUptimeSeconds] = useState(0);
  const [core, setCore] = useState<string>(MOCK_CORE);
  const [mode, setMode] = useState<string>(MOCK_MODE);
  const [configFile, setConfigFile] = useState<string>(CORE_FALLBACK[MOCK_CORE]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 过渡态已持续秒数，用来给"正在启动"配一条走动的计时
  const [transitionSeconds, setTransitionSeconds] = useState(0);

  // 过渡态期间不接受新的操作，用 ref 而不是 state，避免闭包读到旧值
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  /**
   * 当前这次操作的身份牌。每次 dispatch 自增，异步回流时先比对：
   * 对不上说明这次操作已经被后一次取代（或组件已卸载），结果一律丢弃。
   */
  const runIdRef = useRef(0);
  // StrictMode 下挂载副作用会"执行 → 清理 → 再执行"，所以第二次执行必须
  // 把标记重新置回 true，否则后续所有 setState 都会被自己静默丢掉。
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** 把一次探测/命令结果写进状态 */
  const applyStatus = useCallback((status: ServiceStatus) => {
    if (!mountedRef.current) {
      return;
    }

    // 过渡态期间不接受任何"改 phase"的写入。
    //
    // 这是状态与按钮保持一致的兜底：只要 busyRef 为真，就说明操作还没结束，
    // 界面必须停在过渡态（转圈）。否则任何一条探测（轮询、切前台、失败回落）
    // 都可能把 phase 提前推进到 running/stopped，让操作条冒出还点不动的按钮。
    // 真正的落地统一由 dispatch 的 finally 做。
    if (!busyRef.current) {
      setPhase((current) => phaseFromStatus(status, current));
    }

    setCore(status.core ?? '');
    setMode(status.networkMode ?? '');
    setConfigFile(configFileFromStatus(status));

    if (status.state === 'running') {
      setUptimeSeconds(status.uptimeSeconds ?? 0);
    } else if (status.state === 'stopped') {
      setUptimeSeconds(0);
    }
  }, []);

  /**
   * 探测一次真实状态。
   *
   * `keepError` 用于"操作已经失败、这里是失败后的收尾探测"：探测命令本身
   * 通常是成功的（能正常读到 stopped），它的 `error` 字段为空，直接写下去
   * 会把刚拿到的失败原因抹掉。传了就保留原原因，不被空值覆盖。
   */
  const refresh = useCallback(async (keepError?: string) => {
    try {
      const status = await panel.queryServiceStatus();
      applyStatus(status);
      setError(keepError ?? status.error ?? null);
    } catch (reason) {
      // 桥接层自身抛错（例如 WebView 通信失败）时同样不该改状态
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (mountedRef.current) {
        setReady(true);
      }
    }
  }, [applyStatus]);

  // 进入页面先探一次真实状态
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const running = phase === 'running';

  /**
   * 是否正在过渡（转圈中）。
   *
   * `phase` 只在操作**全部结束**时才离开 starting/stopping —— 探测到目标态
   * 达成也只记录、不提前改状态（见 dispatch 里的 poll）。因此这里两个条件
   * 是同步成立的，`busy` 只是让判据更明确：过渡态 ⇔ 命令还在跑。
   *
   * 这样状态与按钮天然同帧切换：不会出现"已显示运行中、按钮却还灰着"。
   */
  const transitioning = busy && (phase === 'starting' || phase === 'stopping');

  // 运行中每秒累加时长，停止时不空转
  useTicker(1000, running);

  useEffect(() => {
    if (!running) {
      return;
    }
    setUptimeSeconds((value) => value + 1);
  }, [running]);

  // 过渡态走动的计时：让"正在启动"有一个连续增长的数字，
  // 用户能看出脚本确实在干活，而不是界面卡死了
  useEffect(() => {
    if (!busy) {
      setTransitionSeconds(0);
      return;
    }

    const startedAt = Date.now();
    setTransitionSeconds(0);

    const timer = window.setInterval(() => {
      setTransitionSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [busy]);

  // 页面重新可见时立即补一次，覆盖"挂在后台时服务被别的途径改了状态"
  useEffect(() => {
    const onVisible = () => {
      // 过渡态有自己的高频探测，这里让路：否则一次 visibilitychange
      // 可能把"正在启动"直接改写成中途的 stopped
      if (document.visibilityState === 'visible' && !busyRef.current) {
        void refresh();
      }
    };

    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  // 低频轮询：让面板上的状态跟内核保持一致，但不至于把设备耗着
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!busyRef.current && document.visibilityState === 'visible') {
        void refresh();
      }
    }, STATUS_POLL_MS);

    return () => window.clearInterval(timer);
  }, [refresh]);

  const dispatch = useCallback(
    (action: ServiceAction) => {
      // 过渡态下不响应，避免"正在启动"时又点出一次启动
      if (busyRef.current) {
        return;
      }

      const command: ServiceCommand = action;
      // 重载不动核心，只有启停/重启才切到过渡态
      const nextPhase: ServicePhase | null =
        action === 'stop'
          ? 'stopping'
          : action === 'reload'
            ? null
            : 'starting';

      busyRef.current = true;
      setBusy(true);
      setError(null);
      if (nextPhase) {
        setPhase(nextPhase);
      }

      // 本次操作的身份牌：命令与探测都是异步的，回流时用它确认
      // 结果还属于当前这次操作（而不是已被取代的旧操作）
      const runId = runIdRef.current + 1;
      runIdRef.current = runId;
      const isCurrent = () => mountedRef.current && runIdRef.current === runId;

      /**
       * 过渡态期间探测到的"目标态已达成"。
       *
       * 注意这里**只记录、不直接改界面**：状态与按钮必须一起切换。
       *
       * ⚠️ 这只是一份**中途快照**，可能已经过时：启动时核心可能先起来、
       * 随后又因为配置问题挂掉。所以它只在"命令正常结束、且拿不到更权威的
       * 最终探测结果"时才有资格作为兜底，绝不能反过来压过最终探测。
       */
      let reachedTarget: ServiceStatus | null = null;

      /** 命令结束后探到的最终状态；由 finally 统一落地，优先级最高 */
      let finalStatus: ServiceStatus | null = null;
      /**
       * 命令判定失败时的原因。
       *
       * 单独记一份是因为下面 `refresh()` 会把 error 覆盖掉：失败的
       * `start` 之后真去探一次，得到的是"干净的 stopped"，error 字段为空，
       * 于是辛苦拿到的失败原因就被抹成 null，界面上什么都不显示。
       */
      let failureReason: string | null = null;

      /**
       * 过渡态期间的进度探测。
       *
       * 命令本身要跑好几秒，这里并行地反复读内核真实状态，尽早知道
       * "核心已经就位"。但**不立刻把 phase 改掉**：
       *
       *   phase 一旦变成 running，操作条就该显示三个按钮；而这段时间命令
       *   还在收尾（busy 仍为 true），按钮只能是灰的 —— 那就出现了
       *   "状态已明确、按钮却点不动"的中间态，正是要避免的。
       *
       * 所以探测只把结果记下来，等命令真正结束、busy 与 phase 能同一帧
       * 落地时，再一起切过去。
       *
       * 两个安全阀：
       *   - 只有"到达目标态"才算数（start 等 running / stop 等 stopped），
       *     启动过程中"进程还没拉起来"是正常中间态。
       *   - 探测失败（unknown）不采纳。
       */
      const pollDuringTransition = window.setInterval(() => {
        if (!isCurrent() || document.visibilityState !== 'visible') {
          return;
        }

        void (async () => {
          try {
            const status = await panel.queryServiceStatus();

            if (!isCurrent() || status.state === 'unknown') {
              return;
            }

            const reached =
              (nextPhase === 'starting' && status.state === 'running') ||
              (nextPhase === 'stopping' && status.state === 'stopped');

            if (reached) {
              reachedTarget = status;
              // 目标态已达成，继续探测没有意义，停表即可。
              // 界面切换留给命令结束那一步统一做。
              window.clearInterval(pollDuringTransition);
            }
          } catch {
            // 过渡态里的探测失败不值得打扰用户，等命令自己的结果说话
          }
        })();
      }, TRANSITION_POLL_MS);

      void (async () => {
        try {
          // 先把过渡态真正画到屏幕上，再下发命令。
          //
          // React 会把 setPhase/setBusy 攒到当前任务结束后再提交；如果紧接着
          // 就发起命令，用户可能先看到一段没有任何变化的旧画面。这里让出两帧
          // （rAF 一次只保证"下一帧之前"，两次才够 React 提交 + 浏览器绘制），
          // 确保"正在启动"先出现在屏幕上，随后才是底层在跑。
          await nextPaint();

          if (!isCurrent()) {
            return;
          }

          await panel.runServiceCommand(command);

          if (!isCurrent()) {
            return;
          }

          const status = await panel.queryServiceStatus();

          if (!isCurrent()) {
            return;
          }

          // 命令退出码为 0 但核心没起来（例如配置文件有误）也要如实反映。
          //
          // 这里**无条件**以这次最终探测为准：还要清掉 reachedTarget ——
          // 它可能记着"刚才核心活过"的中途快照，若不清，finally 会拿它
          // 把界面推回"运行中"，于是启动失败却显示运行中。
          if (command === 'start' && status.state !== 'running') {
            reachedTarget = null;
            failureReason = status.error ?? '核心未能在预期时间内启动，请查看日志';
            finalStatus = { ...status, state: 'stopped' };
            notify(action, 'error', failureReason);
            return;
          }

          // 记录最终状态，真正的写入交给 finally ——
          // 那里已经放开 busyRef，phase 与 busy 才能在同一个批次里落地。
          finalStatus = status;
          notify(action, 'success', `${LABELS[action]}完成`);
        } catch (reason) {
          const text = reason instanceof Error ? reason.message : String(reason);

          if (isCurrent()) {
            // 命令本身抛错（退出码非 0）：原因以它为准，同样清掉中途快照
            reachedTarget = null;
            failureReason = text;
            notify(action, 'error', `${LABELS[action]}失败：${text}`);
          }
        } finally {
          window.clearInterval(pollDuringTransition);
          busyRef.current = false;

          if (mountedRef.current && isCurrent()) {
            // 放开 busyRef 之后才写 phase：状态与按钮同帧切换，
            // 不会出现"已显示运行中、按钮却还灰着"的中间态。
            //
            // 优先级：本次命令的最终探测 > 中途快照。中途快照只在命令
            // 没能给出最终结果时兜底 —— 它可能是过时的（核心起来又挂了）。
            if (finalStatus) {
              applyStatus(finalStatus);
            } else if (reachedTarget) {
              applyStatus(reachedTarget);
            }

            setBusy(false);
            setReady(true);
          }

          // 已经知道真实状态（finalStatus / reachedTarget）就不再补探，
          // 免得 refresh 用探测结果里的空 error 把失败原因抹掉。
          // 只有命令抛错、什么都没探到时才需要拉一次真实状态，
          // 且明确保留 failureReason。
          if (isCurrent() && !finalStatus && !reachedTarget) {
            void refresh(failureReason ?? undefined);
          }
        }
      })();
    },
    [applyStatus, notify, refresh],
  );

  const value = useMemo<ServiceContextValue>(
    () => ({
      phase,
      uptimeSeconds,
      core,
      mode,
      configFile,
      busy,
      transitioning,
      running,
      ready,
      error,
      transitionSeconds,
      dispatch,
      refresh,
    }),
    [
      phase,
      uptimeSeconds,
      core,
      mode,
      configFile,
      busy,
      transitioning,
      running,
      ready,
      error,
      transitionSeconds,
      dispatch,
      refresh,
    ],
  );

  return <ServiceContext.Provider value={value}>{children}</ServiceContext.Provider>;
}

const LABELS: Record<ServiceAction, string> = {
  start: '启动',
  stop: '停止',
  restart: '重启',
  reload: '重载',
};

export function useService(): ServiceContextValue {
  const context = useContext(ServiceContext);

  if (!context) {
    throw new Error('useService 必须在 <ServiceProvider> 内部使用');
  }

  return context;
}

/** 过渡态在横幅上显示的文案 */
export function transitionLabel(phase: ServicePhase): string {
  switch (phase) {
    case 'starting':
      return '正在启动';
    case 'stopping':
      return '正在停止';
    case 'running':
      return '运行中';
    default:
      return '已停止';
  }
}

/**
 * 运行时长文案，停止时不显示。
 *
 * 过渡态下也不显示：读秒只归操作条管，横幅保持干净 ——
 * 两个地方同时跳秒既吵，又和"正在启动"这个主状态抢注意力。
 */
export function uptimeLabel(snapshot: ServiceSnapshot): string | null {
  if (snapshot.phase !== 'running') {
    return null;
  }
  return formatDuration(snapshot.uptimeSeconds);
}
