import styles from './SortSelect.module.css';

interface SortSelectProps {
  label: string;
  options: Array<{ value: string; label: string }>;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
}

export function SortSelect({ label, options, value, onChange, className = '' }: SortSelectProps) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className={`${styles.select} ${className}`}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
