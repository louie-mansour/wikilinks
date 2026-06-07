import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'action' | 'permalink' | 'secondary';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Primary only — three-dot loader; disables the button and sets aria-busy */
  loading?: boolean;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: styles.primary,
  action: styles.action,
  permalink: styles.permalink,
  secondary: styles.secondary,
};

export function Button({
  variant = 'primary',
  className = '',
  loading = false,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const isPrimaryLoading = variant === 'primary' && loading;

  return (
    <button
      className={`${styles.root} ${variantClass[variant]}${isPrimaryLoading ? ` ${styles.loading}` : ''} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {variant === 'primary' ? (
        <>
          <span className={isPrimaryLoading ? styles.visuallyHidden : styles.buttonLabel}>
            {children}
          </span>
          {isPrimaryLoading ? (
            <span className={styles.loadingDots} aria-hidden="true">
              <span className={styles.dot} />
              <span className={styles.dot} />
              <span className={styles.dot} />
            </span>
          ) : null}
        </>
      ) : (
        children
      )}
    </button>
  );
}
