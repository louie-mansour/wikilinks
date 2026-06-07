import { forwardRef } from 'react';
import styles from './Badge.module.css';

export type BadgeVariant = 'new' | 'rare' | 'uncommon' | 'record';

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  new: styles.variantNew,
  rare: styles.rare,
  uncommon: styles.uncommon,
  record: styles.record,
};

const VARIANT_LABEL: Record<BadgeVariant, string> = {
  new: '★ new',
  rare: '★ rare',
  uncommon: '★ uncommon',
  record: '★ new record',
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
