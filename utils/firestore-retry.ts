import type { FirestoreError, Unsubscribe } from 'firebase/firestore';

/**
 * Wraps onSnapshot with a single retry-after-delay on permission-denied.
 * Right after this client writes data that its own security-rule access
 * depends on (e.g. self-adding to a list's collaboratorIds), an already-open
 * listener touching that data can see a transient permission-denied before
 * the write is fully consistent — and Firestore treats permission-denied as
 * terminal, never retrying on its own. One bounded retry recovers cleanly
 * since the underlying rule is correct.
 */
export function subscribeWithRetry<T>(
  subscribe: (onNext: (snap: T) => void, onError: (err: FirestoreError) => void) => Unsubscribe,
  onNext: (snap: T) => void,
  onError: (err: FirestoreError) => void
): () => void {
  let unsubscribe: Unsubscribe | undefined;
  let retryTimeout: ReturnType<typeof setTimeout> | undefined;
  let retried = false;
  let cancelled = false;

  const start = () => {
    unsubscribe = subscribe(onNext, (err) => {
      if (err.code === 'permission-denied' && !retried) {
        retried = true;
        retryTimeout = setTimeout(() => {
          if (cancelled) return;
          unsubscribe?.();
          start();
        }, 1200);
        return;
      }
      onError(err);
    });
  };
  start();

  return () => {
    cancelled = true;
    if (retryTimeout) clearTimeout(retryTimeout);
    unsubscribe?.();
  };
}
