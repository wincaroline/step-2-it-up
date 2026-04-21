import {
  CelebrationModalShell,
  SalmonThumbsUpHero,
  CELEBRATION_MODAL_BODY_SCROLL,
  CELEBRATION_PANEL_SHADOW_MAGENTA,
} from './CelebrationModalShell';

export type GoalReachedModalProps = {
  goalMessage: string;
  dailyQuestions: number;
  onDismiss: () => void;
};

export function GoalReachedModal({ goalMessage, dailyQuestions, onDismiss }: GoalReachedModalProps) {
  return (
    <CelebrationModalShell overlayZIndexClass="z-40" panelShadowClass={CELEBRATION_PANEL_SHADOW_MAGENTA}>
      <div className={CELEBRATION_MODAL_BODY_SCROLL} data-modal-scroll="true">
        <SalmonThumbsUpHero />
        <div className="p-8 pt-6 relative z-10 space-y-6">
          <div className="space-y-2">
            <h2 className="text-cyan-900 text-4xl font-black uppercase leading-none">Goal Reached!</h2>
            <p className="text-cyan-600 font-bold text-lg leading-tight">{goalMessage}</p>
          </div>
          <div className="bg-cyan-50 p-4 rounded-2xl border-2 border-cyan-100">
            <div className="text-cyan-900 font-black text-3xl">{dailyQuestions}</div>
            <div className="text-cyan-400 text-xs font-bold uppercase tracking-widest">Questions Done Today</div>
          </div>
          <button
            onClick={onDismiss}
            className="question-count-clay-btn w-full bg-cyan-600 hover:bg-cyan-700 text-white py-4 rounded-2xl font-black text-xl active:scale-95 transition-all"
          >
            I'll Keep It Up!
          </button>
        </div>
      </div>
    </CelebrationModalShell>
  );
}
