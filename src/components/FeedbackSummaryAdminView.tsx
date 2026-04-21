import { useCallback, useEffect, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Loader2 } from 'lucide-react';
import type { User } from 'firebase/auth';

import { app } from '../firebase';

export type FeedbackSummaryResponse = {
  scannedCount: number;
  isTruncated: boolean;
  uniqueUsers: number;
  totals: {
    all: number;
    bug: number;
    request: number;
    feedback: number;
    unknown: number;
  };
  topKeywords: Array<{ word: string; count: number }>;
  recent: Array<{
    id: string;
    category: string;
    uid: string | null;
    createdAt: string | null;
    descriptionPreview: string;
  }>;
};

type FeedbackSummaryAdminViewProps = {
  authResolved: boolean;
  firebaseUser: User | null;
};

export function FeedbackSummaryAdminView({ authResolved, firebaseUser }: FeedbackSummaryAdminViewProps) {
  const [feedbackSummaryLoading, setFeedbackSummaryLoading] = useState(false);
  const [feedbackSummaryError, setFeedbackSummaryError] = useState<string | null>(null);
  const [feedbackSummaryData, setFeedbackSummaryData] = useState<FeedbackSummaryResponse | null>(null);

  const fetchFeedbackSummary = useCallback(async () => {
    setFeedbackSummaryLoading(true);
    setFeedbackSummaryError(null);
    try {
      const functions = getFunctions(app);
      const callable = httpsCallable(functions, 'getFeedbackSummary');
      const result = await callable();
      setFeedbackSummaryData(result.data as FeedbackSummaryResponse);
    } catch (err) {
      console.error('Failed to load feedback summary', err);
      setFeedbackSummaryError(
        'Unable to load feedback summary. Make sure this account has the admin custom claim and the function is deployed.',
      );
      setFeedbackSummaryData(null);
    } finally {
      setFeedbackSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authResolved) return;
    if (!firebaseUser) {
      setFeedbackSummaryError('Sign in with Google using an admin account to view feedback summary.');
      setFeedbackSummaryData(null);
      return;
    }
    void fetchFeedbackSummary();
  }, [authResolved, firebaseUser, fetchFeedbackSummary]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-10 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Feedback Summary</h1>
            <p className="text-slate-300 mt-1 text-sm sm:text-base">
              Admin-only summary from Firestore `feedbackReports`.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void fetchFeedbackSummary()}
            disabled={feedbackSummaryLoading || !firebaseUser}
            className="question-count-clay-btn inline-flex items-center gap-2 bg-cyan-600 border-2 border-cyan-800 text-white px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-cyan-700 transition-all disabled:opacity-50"
          >
            {feedbackSummaryLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {feedbackSummaryLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {!authResolved && <p className="text-slate-300">Checking sign-in…</p>}
        {feedbackSummaryError && (
          <div className="p-4 rounded-xl border border-red-500/40 bg-red-950/40 text-red-200">
            {feedbackSummaryError}
          </div>
        )}

        {feedbackSummaryData && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-700">
                <div className="text-xs uppercase text-slate-400">All</div>
                <div className="text-2xl font-black">{feedbackSummaryData.totals.all}</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-700">
                <div className="text-xs uppercase text-slate-400">Bug</div>
                <div className="text-2xl font-black">{feedbackSummaryData.totals.bug}</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-700">
                <div className="text-xs uppercase text-slate-400">Request</div>
                <div className="text-2xl font-black">{feedbackSummaryData.totals.request}</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-700">
                <div className="text-xs uppercase text-slate-400">Feedback</div>
                <div className="text-2xl font-black">{feedbackSummaryData.totals.feedback}</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-700">
                <div className="text-xs uppercase text-slate-400">Unique users</div>
                <div className="text-2xl font-black">{feedbackSummaryData.uniqueUsers}</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-700">
                <div className="text-xs uppercase text-slate-400">Scanned</div>
                <div className="text-2xl font-black">{feedbackSummaryData.scannedCount}</div>
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-xl bg-slate-900 border border-slate-700 space-y-3">
              <h2 className="text-lg font-black">Top Keywords</h2>
              <div className="flex flex-wrap gap-2">
                {feedbackSummaryData.topKeywords.length === 0 ? (
                  <p className="text-slate-400 text-sm">No keywords yet.</p>
                ) : (
                  feedbackSummaryData.topKeywords.map((k) => (
                    <span
                      key={k.word}
                      className="px-3 py-1 rounded-full bg-slate-800 border border-slate-600 text-xs font-bold"
                    >
                      {k.word} ({k.count})
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-xl bg-slate-900 border border-slate-700 space-y-3">
              <h2 className="text-lg font-black">Recent Reports</h2>
              <div className="space-y-2">
                {feedbackSummaryData.recent.length === 0 ? (
                  <p className="text-slate-400 text-sm">No feedback reports found.</p>
                ) : (
                  feedbackSummaryData.recent.map((item) => (
                    <div key={item.id} className="p-3 rounded-lg border border-slate-700 bg-slate-950">
                      <div className="text-[11px] uppercase tracking-widest text-cyan-300 font-black">
                        {item.category} {item.createdAt ? `- ${new Date(item.createdAt).toLocaleString()}` : ''}
                      </div>
                      <p className="text-sm text-slate-200 mt-1 whitespace-pre-wrap">{item.descriptionPreview}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
