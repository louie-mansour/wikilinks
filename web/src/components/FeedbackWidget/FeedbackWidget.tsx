import { useRef, useState } from 'react';
import { Frown, Meh, Smile, X } from 'lucide-react';
import { Button } from '../Button/Button';
import styles from './FeedbackWidget.module.css';
import { trackFeedbackRatingSubmitted, trackFeedbackCommentSubmitted } from '../../analytics';

export type FeedbackRating = 1 | 2 | 3;

interface FeedbackWidgetProps {
  /** Persists the rating immediately on click; resolves to a feedback id used to attach a comment later. */
  onRate: (rating: FeedbackRating) => Promise<string>;
  onSubmitComment: (id: string, comment: string) => Promise<void>;
}

const FACES: { rating: FeedbackRating; Icon: typeof Frown; label: string }[] = [
  { rating: 1, Icon: Frown, label: 'Bad' },
  { rating: 2, Icon: Meh, label: 'Okay' },
  { rating: 3, Icon: Smile, label: 'Good' },
];

export function FeedbackWidget({ onRate, onSubmitComment }: FeedbackWidgetProps) {
  const [selectedRating, setSelectedRating] = useState<FeedbackRating | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const ratingPromiseRef = useRef<Promise<string> | null>(null);

  const isOpen = selectedRating !== null && !isDone;

  function handleFaceClick(rating: FeedbackRating) {
    setSelectedRating(rating);
    setIsDone(false);
    trackFeedbackRatingSubmitted({ rating });
    const promise = onRate(rating);
    ratingPromiseRef.current = promise;
    promise.catch(() => {});
  }

  async function handleSubmitComment() {
    const trimmed = comment.trim();
    if (!trimmed) {
      setIsDone(true);
      return;
    }
    setIsSubmittingComment(true);
    try {
      const id = await ratingPromiseRef.current;
      if (id) {
        await onSubmitComment(id, trimmed);
        trackFeedbackCommentSubmitted({ rating: selectedRating, char_count: trimmed.length });
      }
    } catch {
      // Rating never saved (offline/error) — nothing to attach the comment to.
    } finally {
      setIsSubmittingComment(false);
      setIsDone(true);
    }
  }

  function handleClose() {
    setSelectedRating(null);
    setComment('');
    setIsDone(false);
  }

  return (
    <div className={styles.widget}>
      {isDone ? (
        <div className={styles.card}>
          <span className={styles.thanks}>Thanks for your feedback!</span>
          <button type="button" className={styles.closeButton} onClick={handleClose} aria-label="Dismiss">
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>
      ) : (
        <div className={styles.card}>
          <div className={styles.facesRow}>
            <span className={styles.label}>Feedback</span>
            {FACES.map(({ rating, Icon, label }) => (
              <button
                key={rating}
                type="button"
                className={`${styles.face} ${styles[`face-${rating}`]} ${selectedRating === rating ? styles.faceSelected : ''}`}
                onClick={() => handleFaceClick(rating)}
                aria-label={label}
                aria-pressed={selectedRating === rating}
              >
                <Icon size={18} strokeWidth={2} />
              </button>
            ))}
          </div>

          {isOpen ? (
            <div className={styles.panel}>
              <textarea
                className={styles.textarea}
                placeholder="Tell us more (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={2000}
                rows={3}
                autoFocus
              />
              <div className={styles.panelActions}>
                <button type="button" className={styles.skipButton} onClick={() => setIsDone(true)}>
                  Skip
                </button>
                <Button variant="action" onClick={handleSubmitComment} disabled={isSubmittingComment}>
                  Send
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
