import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

/** Stored in Firestore collection {@link FEEDBACK_REPORTS_COLLECTION}. */
export type FeedbackReportCategory = 'bug' | 'request' | 'feedback';

export const FEEDBACK_REPORTS_COLLECTION = 'feedbackReports';

export async function submitFeedbackReport(
  db: Firestore,
  uid: string,
  category: FeedbackReportCategory,
  description: string,
): Promise<void> {
  const trimmed = description.trim();
  await addDoc(collection(db, FEEDBACK_REPORTS_COLLECTION), {
    uid,
    category,
    description: trimmed,
    createdAt: serverTimestamp(),
  });
}
