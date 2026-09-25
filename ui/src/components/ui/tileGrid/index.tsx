import type { ReactNode } from 'react';

import styles from './index.module.less';

interface Tile {
  key: string;
  title: string;
  subtitle: string;
  /** 右上角标记，例如更新核心后的当前核心名 */
  badge?: ReactNode;
  onClick?: () => void;
}

interface TileGridProps {
  tiles: Tile[];
  /** 每行列数，首页快捷入口是 3 列 */
  columns?: number;
}

/** 首页的快捷入口宫格（WebUI / Sub-Store / 日志等入口共用） */
export function TileGrid({ tiles, columns = 3 }: TileGridProps) {
  return (
    <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {tiles.map((tile) => (
        <button key={tile.key} type="button" className={styles.tile} onClick={tile.onClick}>
          <span className={styles.title}>{tile.title}</span>
          <span className={styles.subtitle}>{tile.subtitle}</span>
          {tile.badge ? <span className={styles.badge}>{tile.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}
