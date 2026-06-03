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
  const fullUrl = `https://${urlPrefix}${urlCode}`;

  function handleCopy() {
    navigator.clipboard?.writeText(fullUrl).catch(() => {});
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={styles.bar}>
      <span className={styles.label}>Share</span>
      <span className={styles.urlWrap}>
        <a
          href={fullUrl}
          className={styles.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {urlPrefix}<strong>{urlCode}</strong>
        </a>
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
