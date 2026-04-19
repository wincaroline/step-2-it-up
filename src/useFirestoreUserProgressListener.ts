import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import {
  getUpdatedAtMillis,
  parseUserProgressDoc,
  saveUserProgress,
  stableStringifyProgress,
  userProgressDocRef,
} from './userProgressFirestore';
import type { UserProgressV1 } from './userProgressSchema';

/**
 * Subscribes to `users/{uid}`. First snapshot: migrates local state if missing, otherwise applies remote.
 * Later snapshots: ignores stale server versions while the user has local edits not yet persisted
 * (avoids onSnapshot overwriting new UI with an old document — the "flash then revert" bug).
 */
export function useFirestoreUserProgressListener(options: {
  uid: string | null;
  authResolved: boolean;
  getMigrationPayload: () => UserProgressV1;
  applyProgress: (p: UserProgressV1) => void;
  getLocalProgressJson: () => string;
  lastPushedJsonRef: MutableRefObject<string>;
  lastSeenServerTimeMsRef: MutableRefObject<number>;
}): boolean {
  const [ready, setReady] = useState(false);

  const getMigrationPayloadRef = useRef(options.getMigrationPayload);
  const applyProgressRef = useRef(options.applyProgress);
  const getLocalProgressJsonRef = useRef(options.getLocalProgressJson);
  const lastPushedJsonRef = useRef(options.lastPushedJsonRef);
  const lastSeenServerTimeMsRef = useRef(options.lastSeenServerTimeMsRef);

  getMigrationPayloadRef.current = options.getMigrationPayload;
  applyProgressRef.current = options.applyProgress;
  getLocalProgressJsonRef.current = options.getLocalProgressJson;
  lastPushedJsonRef.current = options.lastPushedJsonRef;
  lastSeenServerTimeMsRef.current = options.lastSeenServerTimeMsRef;

  useEffect(() => {
    if (!options.authResolved || !options.uid) {
      setReady(false);
      return;
    }

    const uid = options.uid as string;
    const docRef = userProgressDocRef(db, uid);
    let cancelled = false;
    let hydrationDone = false;

    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (cancelled) return;

        const pushedRef = lastPushedJsonRef.current;
        const seenRef = lastSeenServerTimeMsRef.current;

        const commitSyncedRemote = (p: UserProgressV1, raw: Record<string, unknown> | undefined) => {
          pushedRef.current = stableStringifyProgress(p);
          seenRef.current = Math.max(seenRef.current, getUpdatedAtMillis(raw));
        };

        if (!snap.exists()) {
          const initial = getMigrationPayloadRef.current();
          saveUserProgress(db, uid, initial).catch((e) => console.error('[Firestore] initial upload failed', e));
          applyProgressRef.current(initial);
          pushedRef.current = stableStringifyProgress(initial);
          seenRef.current = 0;
          hydrationDone = true;
          setReady(true);
          return;
        }

        const data = snap.data() as Record<string, unknown> | undefined;
        const serverMs = getUpdatedAtMillis(data);
        const parsed = parseUserProgressDoc(data);

        if (!hydrationDone) {
          if (parsed) {
            applyProgressRef.current(parsed);
            commitSyncedRemote(parsed, data);
            hydrationDone = true;
            setReady(true);
            return;
          }
          const fallback = getMigrationPayloadRef.current();
          saveUserProgress(db, uid, fallback).catch((e) => console.error('[Firestore] repair upload failed', e));
          applyProgressRef.current(fallback);
          pushedRef.current = stableStringifyProgress(fallback);
          seenRef.current = serverMs;
          hydrationDone = true;
          setReady(true);
          return;
        }

        if (!parsed) {
          const fallback = getMigrationPayloadRef.current();
          saveUserProgress(db, uid, fallback).catch((e) => console.error('[Firestore] repair upload failed', e));
          applyProgressRef.current(fallback);
          pushedRef.current = stableStringifyProgress(fallback);
          seenRef.current = Math.max(seenRef.current, serverMs);
          return;
        }

        const remoteJson = stableStringifyProgress(parsed);
        const localJson = getLocalProgressJsonRef.current();

        if (remoteJson === localJson) {
          pushedRef.current = remoteJson;
          seenRef.current = Math.max(seenRef.current, serverMs);
          return;
        }

        const hasUnsavedEdits = localJson !== pushedRef.current;
        if (hasUnsavedEdits && serverMs <= seenRef.current) {
          return;
        }

        applyProgressRef.current(parsed);
        pushedRef.current = remoteJson;
        seenRef.current = Math.max(seenRef.current, serverMs);
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
