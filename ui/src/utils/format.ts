/** 把秒数格式化成"4 小时 14 分钟"这种中文可读时长 */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));

  // 不满 1 分钟不显示秒数：秒是逐秒跳动的，而"运行时长"是一段稳定信息，
  // 每秒变一次会显得页面一直在闪。用固定文案代替，满 1 分钟后再开始走进位。
  if (total < 60) {
    return '不足 1 分钟';
  }

  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days} 天`);
  }
  if (hours > 0) {
    parts.push(`${hours} 小时`);
  }
  // 分钟位的取舍：只有"天"已在场时才允许省略 0 分钟（"1 天 0 小时"没意义）；
  // 不满 1 天时必须给分钟，否则 3600 秒会变成空串。
  if (minutes > 0 || days === 0) {
    parts.push(`${minutes} 分钟`);
  }

  return parts.slice(0, 2).join(' ');
}
