
import React from 'react';
import { Trophy } from 'lucide-react';
import { Achievement } from '../types';
import { ACHIEVEMENTS } from '../constants';
import { getAchievementStatus, publicAsset } from '../utils';

interface AchievementsSectionProps {
  totalQuestions: number;
  totalPracticeTests: number;
  history: Record<string, number>;
  effectiveTime: Date;
  setSelectedAchievement: (a: Achievement) => void;
  className?: string;
}

export const AchievementsSection: React.FC<AchievementsSectionProps> = React.memo(({
  totalQuestions,
  totalPracticeTests,
  history,
  effectiveTime,
  setSelectedAchievement,
  className = "",
}) => {
  const achievedCount = ACHIEVEMENTS.filter(a => getAchievementStatus(a, totalQuestions, history, effectiveTime, totalPracticeTests)).length;
  
  return (
    <section className={`w-full bg-white/10 backdrop-blur-xl rounded-[3rem] p-6 border-4 border-white/40 shadow-2xl flex flex-col items-center gap-6 ${className}`}>
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-yellow-300" />
          <h2 className="text-2xl font-black text-white uppercase tracking-widest">Achievements</h2>
        </div>
        <p className="text-white/70 font-bold text-sm">{achievedCount} of {ACHIEVEMENTS.length} badges achieved</p>
      </div>
      
      <div className="grid grid-cols-3 gap-4 w-full">
        {ACHIEVEMENTS.map((achievement) => {
          const achieved = getAchievementStatus(achievement, totalQuestions, history, effectiveTime, totalPracticeTests);
          return (
            <div 
              key={achievement.id}
              onClick={() => setSelectedAchievement(achievement)}
              className={`flex flex-col items-center transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                achieved 
                  ? '' 
                  : 'opacity-40'
              }`}
            >
              <div className="w-20 h-20 mb-2 relative flex items-center justify-center rounded-full overflow-hidden border-2 border-white/20 bg-white/5 shadow-lg">
                {achieved ? (
                  <img 
                    src={publicAsset(`assets/graphic_${achievement.image}.png`)} 
                    alt={achievement.title}
                    className="w-full h-full object-cover scale-150"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-2xl font-bold text-gray-400">?</span>
                  </div>
                )}
              </div>
              <div className="text-center">
                <div className="text-[10px] font-black uppercase tracking-wider text-white leading-tight">
                  {achieved ? achievement.title : 'Locked'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
});
