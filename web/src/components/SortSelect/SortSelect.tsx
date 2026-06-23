import styles from './SortSelect.module.css';
import { trackSortChanged } from '../../analytics';

interface SortSelectProps {
  label: string;
  options: Array<{ value: string; label: string }>;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
}

export function SortSelect({ label, options, value, onChange, className = '' }: SortSelectProps) {
  return (
    <div className={`${styles.wrap} ${className}`}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => {
          trackSortChanged({ sort_value: e.target.value });
          onChange?.(e.target.value);
        }}
        className={styles.select}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
