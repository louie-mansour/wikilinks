import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'action' | 'secondary';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: styles.primary,
  action: styles.action,
  secondary: styles.secondary,
};

export function Button({ variant = 'primary', className = '', children, ...props }: ButtonProps) {
  return (
    <button
      className={`${styles.root} ${variantClass[variant]} ${className}`}
      {...props}
    >
      {variant === 'primary' ? (
        <span className={styles.buttonLabel}>{children}</span>
      ) : (
        children
      )}
    </button>
  );
}
