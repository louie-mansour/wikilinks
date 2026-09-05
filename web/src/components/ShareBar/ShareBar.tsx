import { useRef, useState } from 'react';
import { Button } from '../Button/Button';
import styles from './ShareBar.module.css';
import { trackCopyLinkClicked, trackShareLinkClicked } from '../../analytics';

interface ShareBarProps {
  shareBaseUrl: string;
  urlCode: string;
  onActivate: () => Promise<void>;
  onCopy?: () => void;
}

export function ShareBar({ shareBaseUrl, urlCode, onActivate, onCopy }: ShareBarProps) {
  const [copied, setCopied] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const savedRef = useRef(false);
  const fullUrl = `${shareBaseUrl}${urlCode}`;
  const displayPrefix = shareBaseUrl.replace(/^https?:\/\//, '');

  async function activate() {
    if (savedRef.current) return;
    setIsActivating(true);
    try {
      await onActivate();
      savedRef.current = true;
    } finally {
      setIsActivating(false);
    }
  }

  async function handleLinkClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    trackShareLinkClicked({ share_url: fullUrl });
    await activate();
    window.open(fullUrl, '_blank', 'noopener,noreferrer');
  }

  async function handleCopy() {
    trackCopyLinkClicked({ share_url: fullUrl });
    await activate();
    navigator.clipboard?.writeText(fullUrl).catch(() => {});
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={styles.bar}>
      <div className={styles.textRow}>
        <span className={styles.label}>Share</span>
        <a
          href={fullUrl}
          className={styles.url}
          onClick={handleLinkClick}
        >
          {displayPrefix}<strong>{urlCode}</strong>
        </a>
      </div>
      <Button
        variant="permalink"
        onClick={handleCopy}
        disabled={isActivating}
        className={copied ? styles.copied : ''}
      >
        {copied ? 'Copied!' : 'Copy link'}
      </Button>
    </div>
  );
}
