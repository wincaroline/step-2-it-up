import { motion } from 'motion/react';
import { Anchor, LogIn, Sparkles } from 'lucide-react';
import { DEFAULT_EXAM_DATE_KEY } from '../constants';

type OnboardingScreenProps = {
  examDateKey: string;
  dailyGoalQuestions: number;
  onExamDateChange: (value: string) => void;
  onDailyGoalChange: (value: number) => void;
  onContinue: () => void;
  /** Shown only when the user may sign in (auth ready, not signed in). */
  showOptionalGoogleLogin: boolean;
  onLogInWithGoogle: () => void;
  authActionPending?: boolean;
};

export function OnboardingScreen({
  examDateKey,
  dailyGoalQuestions,
  onExamDateChange,
  onDailyGoalChange,
  onContinue,
  showOptionalGoogleLogin,
  onLogInWithGoogle,
  authActionPending = false,
}: OnboardingScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[118] flex items-center justify-center p-4 sm:p-6 bg-[#001a2c]/90 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.92, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white rounded-[3rem] w-[92vw] sm:w-[86vw] max-w-[28rem] border-8 border-blue-400 shadow-[0_0_50px_rgba(0,0,0,0.3)] max-h-[90dvh] min-h-0 flex flex-col overflow-hidden"
      >
        <div className="flex-1 min-h-0 min-w-0 w-full overflow-y-auto overflow-x-hidden overscroll-contain p-8 space-y-6">
          <div className="flex flex-col items-center text-center gap-2">
            <div className="flex items-center justify-center gap-2 text-blue-900">
              <Anchor className="w-8 h-8" aria-hidden />
              <Sparkles className="w-7 h-7 text-cyan-500" aria-hidden />
            </div>
            <h2 className="text-blue-900 text-2xl sm:text-3xl font-black uppercase tracking-tight">Welcome Aboard</h2>
            <p className="text-sm font-medium text-gray-600 leading-relaxed">
              Set your Step 2 exam date and daily question goal. These power your countdown, progress bar, and calendar.
              Change them anytime in Settings.
            </p>
          </div>

          <div className="min-w-0 w-full space-y-4">
            <div className="min-w-0 p-4 bg-gray-50 rounded-2xl border-2 border-gray-100 box-border">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Exam Date</p>
              <input
                type="date"
                value={examDateKey}
                onChange={(e) => onExamDateChange(e.target.value || DEFAULT_EXAM_DATE_KEY)}
                className="block w-full min-w-0 max-w-full box-border bg-white border-2 border-blue-200 rounded-xl px-3 py-2 font-black text-blue-950 focus:outline-none focus:border-blue-400"
              />
            </div>
            <div className="min-w-0 p-4 bg-gray-50 rounded-2xl border-2 border-gray-100 box-border">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                Daily Goal (Questions Per Day)
              </p>
              <input
                type="number"
                min={1}
                max={9999}
                value={dailyGoalQuestions}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  if (!Number.isNaN(n)) onDailyGoalChange(n);
                }}
                className="block w-full min-w-0 max-w-full box-border bg-white border-2 border-blue-200 rounded-xl px-3 py-2 font-black text-blue-950 focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={onContinue}
              className="question-count-clay-btn w-full bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-900 py-3.5 px-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:brightness-105 transition-all active:scale-[0.98]"
            >
              Continue
            </button>
            {showOptionalGoogleLogin && (
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={onLogInWithGoogle}
                  disabled={authActionPending}
                  className="question-count-clay-btn flex items-center justify-center gap-2 w-full bg-white border-2 border-gray-300 text-gray-800 py-3 px-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  <LogIn className="w-4 h-4 shrink-0" aria-hidden />
                  {authActionPending ? 'Opening Google…' : 'Log in with Google'}
                </button>
                <p className="text-center text-[10px] text-gray-500 font-medium">(Optional)</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
