
import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { GraphicMap } from './Graphics';

export const Bubble = React.memo(function Bubble({ delay, size }: { delay: number; size: number; key?: React.Key }) {
  return (
    <motion.div
      initial={{ y: '110vh', opacity: 0, scale: 0.5 }}
      animate={{ 
        y: '-10vh', 
        opacity: [0, 0.8, 0.8, 0],
        x: [0, 20, -20, 0],
        scale: [0.5, 1, 1, 0.8]
      }}
      transition={{ 
        duration: 10 + Math.random() * 10, 
        repeat: Infinity, 
        delay,
        ease: "easeInOut" 
      }}
      className="absolute rounded-full bg-white/40 border border-white/60 pointer-events-none shadow-[inset_0_2px_4px_rgba(255,255,255,0.8)]"
      style={{ 
        left: `${Math.random() * 100}%`,
        width: `${size}px`,
        height: `${size}px`
      }}
    />
  );
});

export const SeaCreature = React.memo(function SeaCreature({ graphic, delay, y }: { graphic: string; delay: number; y: string }) {
  const Graphic = GraphicMap[graphic];
  const duration = useMemo(() => 15 + Math.random() * 10, []);
  
  return (
    <motion.div
      initial={{ x: '-20vw', opacity: 0 }}
      animate={{ 
        x: '120vw', 
        opacity: [0, 1, 1, 0],
        y: [y, `calc(${y} + 20px)`, y]
      }}
      transition={{ 
        duration, 
        repeat: Infinity, 
        delay,
        ease: "linear" 
      }}
      className="absolute pointer-events-none z-0"
      style={{ top: y }}
    >
      {Graphic && <Graphic className="w-24 h-24 opacity-20 grayscale brightness-200" />}
    </motion.div>
  );
});
