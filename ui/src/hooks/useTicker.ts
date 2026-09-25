import { useEffect, useState } from 'react';

/**
 * 每 interval 毫秒触发一次重渲染，用来驱动"运行时长""网速"这类需要走动的数字。
 * enabled 为 false 时完全停止，避免服务停止后还在空转。
 */
export function useTicker(interval: number, enabled = true): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const timer = window.setInterval(() => setTick((value) => value + 1), interval);
    return () => window.clearInterval(timer);
  }, [interval, enabled]);

  return tick;
}
