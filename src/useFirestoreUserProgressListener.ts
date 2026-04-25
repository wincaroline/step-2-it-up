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
 * Later snapshots: if local progress is ahead of the last known persisted snapshot, never apply a
 * diverging remote (even with a higher updatedAt) until the server echoes the same serialized
 * state — avoids the "count drops then pops back" flash from snapshot races with debounced save.
 * Also drops duplicate/same-`updatedAt` listener deliveries so we do not re-apply a stale full doc
 * after local and last-pushed are already in sync (fixes Questions Done Today as well as review).
 */
export function useFirestoreUserProgressListener(options: {
  uid: string | null;
  authResolved: boolean;
  getMigrationPayload: () => UserProgressV1;
  applyProgress: (p: UserProgressV1) => void;
  getLocalProgressJson: () => string;
  lastPushedJsonRef: MutableRefObject<string>;
  lastSeenServerTimeMsRef: MutableRefObject<number>;
  /** When true on first snapshot, writes current local payload to Firestore even if a document already exists (overwrites cloud). */
  overwriteCloudWithLocalFirstRef?: MutableRefObject<boolean>;
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
          if (options.overwriteCloudWithLocalFirstRef) {
            options.overwriteCloudWithLocalFirstRef.current = false;
          }
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
          const overwriteFirst = options.overwriteCloudWithLocalFirstRef?.current ?? false;
          if (overwriteFirst && options.overwriteCloudWithLocalFirstRef) {
            options.overwriteCloudWithLocalFirstRef.current = false;
          }

          if (overwriteFirst) {
            const localPayload = getMigrationPayloadRef.current();
            saveUserProgress(db, uid, localPayload).catch((e) =>
              console.error('[Firestore] overwrite-with-local upload failed', e)
            );
            applyProgressRef.current(localPayload);
            pushedRef.current = stableStringifyProgress(localPayload);
            seenRef.current = Math.max(seenRef.current, serverMs);
            hydrationDone = true;
            setReady(true);
            return;
          }

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
        if (hasUnsavedEdits) {
          // Local state differs from last pushed snapshot. Do not clobber with a server doc that
          // still does not match the client (stale or out-of-order snapshot, even with newer
          // updatedAt) — the matching remote will arrive on the next echo or a later update.
          return;
        }

        if (serverMs <= seenRef.current) {
          // In sync with last known server revision; a divergent `parsed` is a duplicate/echo we
          // have already "seen" by time — do not apply and revert daily / review / etc.
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
