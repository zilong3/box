import { Children, Fragment, type ReactNode } from 'react';

import { Card } from '../card';
import { RowDivider } from '../listRow';

interface SectionProps {
  children: ReactNode;
  /** 可选分组标题，显示在卡片上方 */
  title?: ReactNode;
}

/**
 * 一组行的容器：包成一张圆角卡，并在相邻行之间自动插入分隔线。
 * 工具页和设置页的每个分组都用它，避免每处手写 RowDivider。
 */
export function Section({ children, title }: SectionProps) {
  const items = Children.toArray(children).filter(Boolean);

  return (
    <div>
      {title ? <div className="box-section-title">{title}</div> : null}
      <Card grouped>
        {items.map((child, index) => (
          <Fragment key={index}>
            {index > 0 ? <RowDivider /> : null}
            {child}
          </Fragment>
        ))}
      </Card>
    </div>
  );
}
