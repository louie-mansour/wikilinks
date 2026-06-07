import { useEffect, useState } from 'react';
import {
  messagesForPhase,
  type LoadingPhase,
} from './loadingMessages';
import styles from './LoadingState.module.css';

const MESSAGE_VISIBLE_MS = 2800;
const MESSAGE_EXIT_MS = 420;

interface LoadingStateProps {
  phase?: LoadingPhase;
  className?: string;
}

export function LoadingState({ phase = 'paths', className = '' }: LoadingStateProps) {
  const messages = messagesForPhase(phase);
  const [index, setIndex] = useState(0);
  const [anim, setAnim] = useState<'in' | 'out'>('in');

  useEffect(() => {
    setIndex(0);
    setAnim('in');
  }, [phase]);

  useEffect(() => {
    const showTimer = window.setTimeout(() => setAnim('out'), MESSAGE_VISIBLE_MS);
    return () => window.clearTimeout(showTimer);
  }, [index, phase]);

  useEffect(() => {
    if (anim !== 'out') return undefined;

    const advanceTimer = window.setTimeout(() => {
      setIndex((i) => (i + 1) % messages.length);
      setAnim('in');
    }, MESSAGE_EXIT_MS);

    return () => window.clearTimeout(advanceTimer);
  }, [anim, messages.length]);

  const message = messages[index];

  return (
    <div
      className={`${styles.root} ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className={styles.messageWrap}>
        <p
          key={`${phase}-${index}`}
          className={`${styles.message} ${anim === 'in' ? styles.messageIn : styles.messageOut}`}
        >
          {message}
        </p>
      </div>
      <span className={styles.srOnly}>
        {phase === 'articles' ? 'Picking articles' : 'Finding paths'}: {message}
      </span>
    </div>
  );
}
