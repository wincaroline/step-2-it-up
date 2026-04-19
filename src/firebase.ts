import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/** Trim and strip one pair of surrounding quotes (common mistake when pasting into GitHub Secrets). */
function envStr(v: unknown): string {
  if (v == null) return '';
  let s = String(v).trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

const firebaseConfig = {
  apiKey: envStr(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: envStr(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: envStr(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: envStr(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: envStr(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: envStr(import.meta.env.VITE_FIREBASE_APP_ID),
};

function getOrInitApp(): FirebaseApp {
  const existing = getApps()[0];
  if (existing) return existing;
  return initializeApp(firebaseConfig);
}

export const app = getOrInitApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
