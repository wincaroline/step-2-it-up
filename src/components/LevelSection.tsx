
import React from 'react';
import { motion } from 'motion/react';
import { Level } from '../types';
import { graphicAsset } from '../utils';

interface LevelSectionProps {
  currentLevel: Level;
  currentLevelIndex: number;
  displayVariant: string;
  isWarningMode: boolean;
  nextLevel: Level | undefined;
  questionsToNext: number;
  unlockedVariantsCount: number;
  setShowImageViewer: (show: boolean) => void;
  setShowVariantModal: (show: boolean) => void;
  setShowLevelMap: (show: boolean) => void;
}

export const LevelSection: React.FC<LevelSectionProps> = React.memo(({
  currentLevel,
  currentLevelIndex,
  displayVariant,
  isWarningMode,
  nextLevel,
  questionsToNext,
  unlockedVariantsCount,
  setShowImageViewer,
  setShowVariantModal,
  setShowLevelMap,
}) => {
  return (
    <section className="w-full bg-white/10 backdrop-blur-xl rounded-[3rem] p-6 border-4 border-white/40 shadow-2xl flex flex-col items-center text-center gap-6">
      <div className="flex flex-col items-center">
        <div className={`font-black text-yellow-300 drop-shadow-sm uppercase tracking-[0.2em] leading-none header-text ${isWarningMode ? 'text-lg opacity-60' : 'text-2xl'}`}>
          Level {currentLevelIndex + 1} of 15
        </div>
        <div className={`font-bold text-white mt-3 drop-shadow-lg header-text ${isWarningMode ? 'text-xl' : 'text-5xl'}`}>
          {isWarningMode ? `You're just a little ${currentLevel.name.toLowerCase()}.` : `You are a ${currentLevel.name}!`}
        </div>
      </div>
    
      <div 
        onClick={() => setShowImageViewer(true)}
        className={`${isWarningMode ? 'w-[100px] h-[100px]' : 'w-full aspect-square'} overflow-hidden rounded-[2.5rem] border-4 border-white/20 shadow-2xl bg-white/5 cursor-zoom-in active:scale-[0.98] transition-all hover:border-white/40 group relative`}
      >
        {!isWarningMode && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center">
            <span className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/30 font-bold text-sm">Click to Zoom</span>
          </div>
        )}
        <motion.img 
          key={displayVariant}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          src={graphicAsset(displayVariant)}
          alt={currentLevel.name} 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      </div>

      {unlockedVariantsCount > 1 && (
        <button
          onClick={() => setShowVariantModal(true)}
          className="mt-2 text-xs font-bold bg-white/20 hover:bg-white/30 px-4 py-2 rounded-full transition-all border border-white/30"
        >
          Switch Version
        </button>
      )}

      {!isWarningMode && (
        <div className="space-y-3">
          <p className="text-3xl font-medium text-yellow-100 drop-shadow-md leading-relaxed max-w-md mx-auto">
            {currentLevel.description}
          </p>
        </div>
      )}

      {nextLevel && (
        <div 
          onClick={() => setShowLevelMap(true)}
          className="mt-2 bg-black/30 px-6 py-3 rounded-full text-sm font-black uppercase tracking-[0.2em] border border-white/20 shadow-lg cursor-pointer hover:bg-black/40 transition-all"
        >
          <span className="text-cyan-300">{questionsToNext}</span> Questions to next level
        </div>
      )}
    </section>
  );
});
