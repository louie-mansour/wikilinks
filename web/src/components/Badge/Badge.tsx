import { forwardRef } from 'react';
import styles from './Badge.module.css';

export type BadgeVariant = 'first' | 'rare' | 'uncommon' | 'record';

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  first: styles.first,
  rare: styles.rare,
  uncommon: styles.uncommon,
  record: styles.record,
};

const VARIANT_LABEL: Record<BadgeVariant, string> = {
  first: '★ first',
  rare: '★ rare',
  uncommon: '★ uncommon',
  record: '★ record',
};

interface BadgeProps {
  variant: BadgeVariant;
  className?: string;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  function Badge({ variant, className = '' }, ref) {
    return (
      <span ref={ref} className={`${styles.root} ${VARIANT_CLASS[variant]} ${className}`}>
        {VARIANT_LABEL[variant]}
      </span>
    );
  }
);
