import type { CSSProperties, ReactNode } from 'react';
import styles from './PanelEnter.module.css';

interface PanelEnterProps {
  index: number;
  children: ReactNode;
  className?: string;
}

export function PanelEnter({ index, children, className }: PanelEnterProps) {
  return (
    <div
      className={className ? `${styles.root} ${className}` : styles.root}
      data-panel-enter
      style={{ '--panel-i': index } as CSSProperties}
    >
      {children}
    </div>
  );
}
