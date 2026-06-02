import { useState } from 'react';
import { Button } from '../Button/Button';
import styles from './ShareBar.module.css';

interface ShareBarProps {
  urlPrefix: string;
  urlCode: string;
  onCopy?: () => void;
}

export function ShareBar({ urlPrefix, urlCode, onCopy }: ShareBarProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const fullUrl = `https://${urlPrefix}${urlCode}`;
    navigator.clipboard?.writeText(fullUrl).catch(() => {});
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={styles.bar}>
      <span className={styles.label}>Share</span>
      <span className={styles.url}>
        {urlPrefix}<strong>{urlCode}</strong>
      </span>
      <Button
        variant="permalink"
        onClick={handleCopy}
        className={copied ? styles.copied : ''}
      >
        {copied ? 'Copied!' : 'Copy link'}
      </Button>
    </div>
  );
}
