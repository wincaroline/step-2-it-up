import {
  CelebrationModalShell,
  CELEBRATION_MODAL_BODY_SCROLL,
  CELEBRATION_PANEL_SHADOW_CYAN,
} from './CelebrationModalShell';
import { graphicAsset } from '../utils';

export type VariantPickerModalProps = {
  displayVariant: string;
  unlockedVariants: string[];
  onSelectVariant: (variant: string) => void;
  onClose: () => void;
};

export function VariantPickerModal({
  displayVariant,
  unlockedVariants,
  onSelectVariant,
  onClose,
}: VariantPickerModalProps) {
  return (
    <CelebrationModalShell overlayZIndexClass="z-50" panelShadowClass={CELEBRATION_PANEL_SHADOW_CYAN}>
      <div className={`${CELEBRATION_MODAL_BODY_SCROLL} p-6 sm:p-8`} data-modal-scroll="true">
        <h2 className="text-cyan-900 text-3xl font-black uppercase leading-none mb-6">Switch Version</h2>
        <div className="grid grid-cols-2 gap-4">
          {unlockedVariants.map((variant) => (
            <div
              key={variant}
              onClick={() => {
                onSelectVariant(variant);
              }}
              className={`cursor-pointer rounded-2xl border-4 overflow-hidden transition-all hover:scale-105 ${displayVariant === variant ? 'border-cyan-500 shadow-lg' : 'border-gray-200 opacity-70'}`}
            >
              <img src={graphicAsset(variant)} alt={variant} className="w-full aspect-square object-cover object-center" />
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          className="question-count-clay-btn mt-8 w-full bg-gray-200 hover:bg-gray-300 text-gray-800 py-4 rounded-2xl font-black text-xl active:scale-95 transition-all"
        >
          Close
        </button>
      </div>
    </CelebrationModalShell>
  );
}
