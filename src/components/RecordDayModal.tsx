import {
  CelebrationModalShell,
  SalmonThumbsUpHero,
  CELEBRATION_MODAL_BODY_SCROLL,
  CELEBRATION_PANEL_SHADOW_MAGENTA,
} from './CelebrationModalShell';

export type RecordDayModalProps = {
  recordDayModalCount: number;
  onDismiss: () => void;
};

export function RecordDayModal({ recordDayModalCount, onDismiss }: RecordDayModalProps) {
  return (
    <CelebrationModalShell overlayZIndexClass="z-40" panelShadowClass={CELEBRATION_PANEL_SHADOW_MAGENTA}>
      <div className={CELEBRATION_MODAL_BODY_SCROLL} data-modal-scroll="true">
        <SalmonThumbsUpHero />
        <div className="p-8 pt-6 relative z-10 space-y-6">
          <div className="space-y-2">
            <h2 className="text-cyan-900 text-4xl font-black uppercase leading-none">New Record!</h2>
            <p className="text-cyan-600 font-bold text-lg leading-tight">
              That is your best single-day total yet. Keep riding the wave!
            </p>
          </div>
          <div className="bg-cyan-50 p-4 rounded-2xl border-2 border-cyan-100">
            <div className="text-cyan-900 font-black text-3xl">{recordDayModalCount}</div>
            <div className="text-cyan-400 text-xs font-bold uppercase tracking-widest">Record Questions In A Day</div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="question-count-clay-btn w-full bg-cyan-600 hover:bg-cyan-700 text-white py-4 rounded-2xl font-black text-xl active:scale-95 transition-all"
          >
            {"Let's Go!"}
          </button>
        </div>
      </div>
    </CelebrationModalShell>
  );
}
