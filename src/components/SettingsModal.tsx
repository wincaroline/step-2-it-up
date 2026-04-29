import type { RefObject } from 'react';
import { motion } from 'motion/react';
import {
  ChevronUp,
  Zap,
  X,
  Pencil,
  Volume2,
  VolumeX,
  Trash2,
  LogIn,
  LogOut,
  Loader2,
} from 'lucide-react';
import type { User } from 'firebase/auth';

import { DEFAULT_EXAM_DATE_KEY } from '../constants';
import { formatExamDateLabel, clampDailyGoal } from '../utils';

const modalPanelSizeClass = 'w-[92vw] sm:w-[86vw] lg:w-[74vw] max-w-[44rem] max-h-[90dvh]';
const modalShellLayoutClass = 'min-h-0 flex flex-col overflow-hidden';
const modalBodyScrollClass = 'flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Value for `<input type="datetime-local">` in local time (seconds not shown / zero). */
function toDatetimeLocalValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function parseDatetimeLocal(raw: string): Date | null {
  const trimmed = raw.trim();
  const [datePart, timePartRaw] = trimmed.split('T');
  if (!datePart || !timePartRaw) return null;
  const timePart = timePartRaw.split('.')[0];
  const [y, mo, d] = datePart.split('-').map(Number);
  const parts = timePart.split(':').map(Number);
  const h = parts[0];
  const m = parts[1];
  if ([y, mo, d, h, m].some((x) => Number.isNaN(x))) return null;
  return new Date(y, mo - 1, d, h, m, 0, 0);
}

export type SettingsModalProps = {
  onDiscardClose: () => void;
  onSaveAndClose: () => void;
  examDateKey: string;
  setExamDateKey: (value: string) => void;
  editingExamDate: boolean;
  setEditingExamDate: (value: boolean) => void;
  dailyGoalQuestions: number;
  setDailyGoalQuestions: (value: number) => void;
  editingDailyGoal: boolean;
  setEditingDailyGoal: (value: boolean) => void;
  isMuted: boolean;
  setIsMuted: (value: boolean) => void;
  isTestMode: boolean;
  setIsTestMode: (value: boolean) => void;
  exitAdminMode: () => void;
  showTestCodeInput: boolean;
  setShowTestCodeInput: (value: boolean) => void;
  testCodeInput: string;
  setTestCodeInput: (value: string) => void;
  adminCodeInputRef: RefObject<HTMLInputElement | null>;
  effectiveTime: Date;
  setSimulatedTime: (value: Date | null) => void;
  simulateStreak: (days: number) => void;
  isWarningMode: boolean;
  setIsWarningMode: (value: boolean) => void;
  adminSleepModeForceOn: boolean;
  setAdminSleepModeForceOn: (value: boolean) => void;
  openFeedbackSummaryTab: () => void;
  isConfirmingClear: boolean;
  setIsConfirmingClear: (value: boolean) => void;
  clearAllData: () => void;
  authResolved: boolean;
  firebaseUser: User | null;
  handleSignOut: () => void;
  authActionPending: boolean;
  handleContinueWithGoogleClick: () => void;
};

export function SettingsModal({
  onDiscardClose,
  onSaveAndClose,
  examDateKey,
  setExamDateKey,
  editingExamDate,
  setEditingExamDate,
  dailyGoalQuestions,
  setDailyGoalQuestions,
  editingDailyGoal,
  setEditingDailyGoal,
  isMuted,
  setIsMuted,
  isTestMode,
  setIsTestMode,
  exitAdminMode,
  showTestCodeInput,
  setShowTestCodeInput,
  testCodeInput,
  setTestCodeInput,
  adminCodeInputRef,
  effectiveTime,
  setSimulatedTime,
  simulateStreak,
  isWarningMode,
  setIsWarningMode,
  adminSleepModeForceOn,
  setAdminSleepModeForceOn,
  openFeedbackSummaryTab,
  isConfirmingClear,
  setIsConfirmingClear,
  clearAllData,
  authResolved,
  firebaseUser,
  handleSignOut,
  authActionPending,
  handleContinueWithGoogleClick,
}: SettingsModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-[#001a2c]/90 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.5, y: 100 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.5, y: 100 }}
        className={`bg-white rounded-[3rem] ${modalPanelSizeClass} ${modalShellLayoutClass} border-8 border-blue-400 shadow-[0_0_50px_rgba(0,0,0,0.3)] relative`}
      >
        <div className={`${modalBodyScrollClass} p-8 space-y-6 custom-scrollbar`} data-modal-scroll="true">
          <div className="flex items-center justify-between">
            <h2 className="text-blue-900 text-3xl font-black uppercase">Settings</h2>
            <button onClick={onDiscardClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X className="w-6 h-6 text-gray-400" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="text-gray-500 font-bold text-xs uppercase tracking-widest">General</div>
            <div className="flex flex-col gap-3">
              <div className="p-4 bg-gray-50 rounded-2xl border-2 border-gray-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Exam Date</p>
                {editingExamDate ? (
                  <input
                    type="date"
                    value={examDateKey}
                    onChange={(e) => setExamDateKey(e.target.value || DEFAULT_EXAM_DATE_KEY)}
                    onBlur={() => setEditingExamDate(false)}
                    className="w-full bg-white border-2 border-blue-200 rounded-xl px-3 py-2 font-black text-blue-950 focus:outline-none focus:border-blue-400"
                  />
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-blue-950 text-sm">{formatExamDateLabel(examDateKey)}</span>
                    <button
                      type="button"
                      aria-label="Edit exam date"
                      onClick={() => setEditingExamDate(true)}
                      className="p-1.5 rounded-lg hover:bg-gray-200/80 text-blue-400 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border-2 border-gray-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                  Daily Goal (Questions Per Day)
                </p>
                {editingDailyGoal ? (
                  <input
                    type="number"
                    min={1}
                    max={9999}
                    value={dailyGoalQuestions}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      if (!Number.isNaN(n)) setDailyGoalQuestions(clampDailyGoal(n));
                    }}
                    onBlur={() => setEditingDailyGoal(false)}
                    className="w-full bg-white border-2 border-blue-200 rounded-xl px-3 py-2 font-black text-blue-950 focus:outline-none focus:border-blue-400"
                  />
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-blue-950 text-sm">{dailyGoalQuestions} questions</span>
                    <button
                      type="button"
                      aria-label="Edit daily goal"
                      onClick={() => setEditingDailyGoal(true)}
                      className="p-1.5 rounded-lg hover:bg-gray-200/80 text-blue-400 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border-2 border-gray-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Sound</p>
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className={`question-count-clay-btn w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${isMuted ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' : 'bg-cyan-50 border-cyan-200 text-cyan-800 hover:bg-cyan-100'}`}
                  aria-label={isMuted ? 'Turn sound on' : 'Turn sound off'}
                >
                  <span className="font-black text-sm uppercase tracking-wider">{isMuted ? 'Sound Off' : 'Sound On'}</span>
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="text-gray-500 font-bold text-xs uppercase tracking-widest">Admin</div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  <span className="font-black uppercase text-sm text-blue-900">Admin Mode</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (isTestMode) {
                      exitAdminMode();
                    } else {
                      setShowTestCodeInput(true);
                    }
                  }}
                  className={`w-12 h-6 rounded-full transition-colors relative ${isTestMode ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <motion.div animate={{ x: isTestMode ? 24 : 4 }} className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                </button>
              </div>

              {showTestCodeInput && !isTestMode && (
                <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2">
                  <p className="text-[10px] font-black uppercase text-blue-400">Enter Admin Code</p>
                  <div className="flex gap-2">
                    <input
                      ref={adminCodeInputRef}
                      type="password"
                      maxLength={4}
                      value={testCodeInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTestCodeInput(val);
                        if (val === '1513') {
                          setIsTestMode(true);
                          setShowTestCodeInput(false);
                          setTestCodeInput('');
                        }
                      }}
                      placeholder="****"
                      className="w-full min-w-0 bg-white border-2 border-blue-200 rounded-xl px-4 py-2 text-center font-black tracking-[0.5em] text-blue-900 focus:outline-none focus:border-blue-400"
                    />
                  </div>
                </div>
              )}

              {isTestMode && (
                <div className="flex flex-col gap-2 p-4 bg-blue-50 rounded-2xl border-2 border-blue-100">
                  <div className="text-blue-900 font-black text-xs uppercase tracking-widest">
                    Current Date & Time (Simulated)
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="datetime-local"
                      className="min-w-0 flex-1 bg-white border-2 border-blue-200 rounded-xl px-4 py-2 font-black text-blue-900 focus:outline-none focus:border-blue-400"
                      value={toDatetimeLocalValue(effectiveTime)}
                      onChange={(e) => {
                        const parsed = parseDatetimeLocal(e.target.value);
                        if (parsed) setSimulatedTime(parsed);
                      }}
                      onInput={(e) => {
                        const parsed = parseDatetimeLocal((e.target as HTMLInputElement).value);
                        if (parsed) setSimulatedTime(parsed);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setSimulatedTime(null)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-xl font-black text-xs hover:bg-blue-700 transition-all"
                    >
                      RESET
                    </button>
                  </div>
                </div>
              )}

              {isTestMode && (
                <div className="flex flex-col gap-2 p-4 bg-purple-50 rounded-2xl border-2 border-purple-100">
                  <div className="text-purple-900 font-black text-xs uppercase tracking-widest">Simulate Past Streaks</div>
                  <p className="text-xs text-purple-700 font-medium">
                    Instantly adds 10 questions/day for the specified duration (ending today) and triggers the achievement!
                  </p>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => simulateStreak(3)}
                      className="bg-purple-600 text-white px-3 py-2 rounded-xl font-black text-xs hover:bg-purple-700 transition-all"
                    >
                      3 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => simulateStreak(5)}
                      className="bg-purple-600 text-white px-3 py-2 rounded-xl font-black text-xs hover:bg-purple-700 transition-all"
                    >
                      5 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => simulateStreak(10)}
                      className="bg-purple-600 text-white px-3 py-2 rounded-xl font-black text-xs hover:bg-purple-700 transition-all"
                    >
                      10 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => simulateStreak(20)}
                      className="bg-purple-600 text-white px-3 py-2 rounded-xl font-black text-xs hover:bg-purple-700 transition-all"
                    >
                      20 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => simulateStreak(30)}
                      className="bg-purple-600 text-white px-3 py-2 rounded-xl font-black text-xs hover:bg-purple-700 transition-all"
                    >
                      30 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => simulateStreak(40)}
                      className="bg-purple-600 text-white px-3 py-2 rounded-xl font-black text-xs hover:bg-purple-700 transition-all"
                    >
                      40 Days
                    </button>
                  </div>
                </div>
              )}

              {isTestMode && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-red-500" />
                    <span className="font-black uppercase text-sm text-blue-900">Warning Mode</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isWarningMode;
                      setIsWarningMode(next);
                      if (next) setAdminSleepModeForceOn(false);
                    }}
                    className={`w-12 h-6 rounded-full transition-colors relative ${isWarningMode ? 'bg-red-500' : 'bg-gray-300'}`}
                  >
                    <motion.div animate={{ x: isWarningMode ? 24 : 4 }} className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                  </button>
                </div>
              )}

              {isTestMode && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <Zap className="w-5 h-5 text-slate-500 shrink-0" />
                    <div className="min-w-0">
                      <span className="font-black uppercase text-sm text-blue-900 block">Sleep Mode (test)</span>
                      <span className="text-[10px] font-medium text-gray-500 normal-case tracking-normal">
                        While Admin Mode is on, only this toggle controls Sleep Mode (natural night window is paused).
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !adminSleepModeForceOn;
                      setAdminSleepModeForceOn(next);
                      if (next) setIsWarningMode(false);
                    }}
                    className={`w-12 h-6 shrink-0 rounded-full transition-colors relative ${adminSleepModeForceOn ? 'bg-indigo-500' : 'bg-gray-300'}`}
                  >
                    <motion.div animate={{ x: adminSleepModeForceOn ? 24 : 4 }} className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                  </button>
                </div>
              )}

              {isTestMode && (
                <button
                  type="button"
                  onClick={openFeedbackSummaryTab}
                  className="question-count-clay-btn w-full bg-cyan-600 border-2 border-cyan-800 text-white py-3 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-cyan-700 transition-all"
                >
                  View Feedback
                </button>
              )}
            </div>
          </div>

          {/* Daily mission resets automatically via date-based completion */}

          {isTestMode && (
            <>
              <div className="text-gray-500 font-bold text-xs uppercase tracking-widest">Danger Zone</div>

              {!isConfirmingClear ? (
                <button
                  onClick={() => setIsConfirmingClear(true)}
                  className="w-full flex items-center justify-between p-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl border-2 border-red-100 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <Trash2 className="w-5 h-5" />
                    <span className="font-black uppercase text-sm">Clear All Data</span>
                  </div>
                  <ChevronUp className="w-4 h-4 rotate-90 opacity-0 group-hover:opacity-100 transition-all" />
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-red-600 font-black uppercase text-center animate-pulse">Are you absolutely sure?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={clearAllData}
                      className="question-count-clay-btn flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-black text-sm active:scale-95 transition-all"
                    >
                      YES, DELETE
                    </button>
                    <button
                      onClick={() => setIsConfirmingClear(false)}
                      className="question-count-clay-btn flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-3 rounded-xl font-black text-sm active:scale-95 transition-all"
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              )}

              <p className="text-[10px] text-red-400 font-bold px-2 italic">
                * This will reset your daily goal, total questions, and levels.
              </p>
            </>
          )}

          <div className="space-y-4">
            <div className="text-gray-500 font-bold text-xs uppercase tracking-widest">Account</div>
            {!authResolved ? (
              <p className="text-sm font-medium text-gray-400">Checking sign-in…</p>
            ) : firebaseUser ? (
              <div className="flex flex-col gap-3 p-4 bg-sky-50 rounded-2xl border-2 border-sky-100">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-sky-600">Signed in</p>
                    <p className="font-black text-blue-950 truncate text-sm mt-1">
                      {firebaseUser.email ?? firebaseUser.displayName ?? 'Google user'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={authActionPending}
                  className="question-count-clay-btn flex items-center justify-center gap-2 w-full bg-red-600 border-2 border-red-700 text-white py-3 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-red-700 hover:border-red-800 transition-all disabled:opacity-50"
                >
                  {authActionPending ? (
                    <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                  ) : (
                    <LogOut className="w-4 h-4 shrink-0" />
                  )}
                  {authActionPending ? 'Signing out…' : 'Sign out'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleContinueWithGoogleClick}
                disabled={authActionPending}
                className="question-count-clay-btn flex items-center justify-center gap-2 w-full bg-white border-2 border-gray-200 text-gray-800 py-3 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-gray-50 transition-all disabled:opacity-50"
              >
                <LogIn className="w-4 h-4 shrink-0" />
                {authActionPending ? 'Opening Google…' : 'Log In with Google'}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onSaveAndClose}
            className="question-count-clay-btn w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-xl active:scale-95 transition-all"
          >
            Save
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
