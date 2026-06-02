import styles from './Badge.module.css';

export type BadgeVariant = 'first' | 'rare' | 'uncommon' | 'record';

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant, children, className = '' }: BadgeProps) {
  return (
    <span className={`${styles.root} ${styles[variant]} ${className}`}>
      {children}
    </span>
  );
}
