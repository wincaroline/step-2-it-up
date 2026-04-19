import { useEffect, useRef, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import {
  parseUserProgressDoc,
  saveUserProgress,
  userProgressDocRef,
} from './userProgressFirestore';
import type { UserProgressV1 } from './userProgressSchema';

/**
 * Subscribes to `users/{uid}`. First snapshot: migrates local state if missing,
 * otherwise applies remote progress. Returns `true` once the first snapshot is handled.
 */
export function useFirestoreUserProgressListener(options: {
  uid: string | null;
  authResolved: boolean;
  /** Latest progress for first-time cloud upload (empty doc). */
  getMigrationPayload: () => UserProgressV1;
  applyProgress: (p: UserProgressV1) => void;
}): boolean {
  const [ready, setReady] = useState(false);
  const getMigrationPayloadRef = useRef(options.getMigrationPayload);
  const applyProgressRef = useRef(options.applyProgress);
  getMigrationPayloadRef.current = options.getMigrationPayload;
  applyProgressRef.current = options.applyProgress;

  useEffect(() => {
    if (!options.authResolved || !options.uid) {
      setReady(false);
      return;
    }

    const uid = options.uid as string;
    const docRef = userProgressDocRef(db, uid);
    let cancelled = false;

    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (cancelled) return;
        if (!snap.exists()) {
          const initial = getMigrationPayloadRef.current();
          saveUserProgress(db, uid, initial).catch((e) => console.error('[Firestore] initial upload failed', e));
          applyProgressRef.current(initial);
          setReady(true);
          return;
        }
        const parsed = parseUserProgressDoc(snap.data());
        if (parsed) {
          applyProgressRef.current(parsed);
          setReady(true);
          return;
        }
        const fallback = getMigrationPayloadRef.current();
        saveUserProgress(db, uid, fallback).catch((e) => console.error('[Firestore] repair upload failed', e));
        applyProgressRef.current(fallback);
        setReady(true);
      },
      (err) => console.error('[Firestore] snapshot error', err)
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [options.authResolved, options.uid]);

  return ready;
}
