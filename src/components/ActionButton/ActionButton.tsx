import styles from './ActionButton.module.css';

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
}

export function ActionButton({ className = '', children, ...props }: ActionButtonProps) {
  return (
    <button
      type="button"
      className={`${styles.root} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
