import type { ReactNode } from 'react';
import { motion } from 'motion/react';

import { graphicAsset } from '../utils';

export const CELEBRATION_MODAL_PANEL_SIZE = 'w-[92vw] sm:w-[86vw] lg:w-[74vw] max-w-[44rem] max-h-[90dvh]';
export const CELEBRATION_MODAL_SHELL_LAYOUT = 'min-h-0 flex flex-col overflow-hidden';
export const CELEBRATION_MODAL_BODY_SCROLL = 'flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain';

const PANEL_BASE = `bg-white rounded-[3rem] ${CELEBRATION_MODAL_PANEL_SIZE} ${CELEBRATION_MODAL_SHELL_LAYOUT} text-center border-8 border-cyan-400`;

/** Magenta glow used by Goal Reached + New Record modals. */
export const CELEBRATION_PANEL_SHADOW_MAGENTA = 'shadow-[0_0_50px_#ff00ff,0_0_100px_#ff00ff]';
/** Cyan glow used by the variant picker modal. */
export const CELEBRATION_PANEL_SHADOW_CYAN = 'shadow-[0_0_50px_#00ffff,0_0_100px_#00ffff]';

export type CelebrationModalShellProps = {
  overlayZIndexClass: string;
  panelShadowClass: string;
  children: ReactNode;
};

/** Shared overlay + scaled panel shell for cyan “celebration” style modals (Goal / Record / Variant picker). */
export function CelebrationModalShell({
  overlayZIndexClass,
  panelShadowClass,
  children,
}: CelebrationModalShellProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 ${overlayZIndexClass} flex items-center justify-center p-4 sm:p-6 bg-[#001a2c]/90 backdrop-blur-md`}
    >
      <motion.div
        initial={{ scale: 0.5, y: 100 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.5, y: 100 }}
        className={`${PANEL_BASE} ${panelShadowClass} relative`}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/** Hero strip used by Goal Reached + New Record modals. */
export function SalmonThumbsUpHero() {
  return (
    <div className="w-full h-[220px] md:h-[350px] shrink-0 bg-cyan-50 overflow-hidden">
      <motion.img
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        src={graphicAsset('salmonthumbsup')}
        alt="Salmon Thumbs Up"
        className="w-full h-full object-cover object-center"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
