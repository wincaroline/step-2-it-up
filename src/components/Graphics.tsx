
import React from 'react';
import { motion } from 'motion/react';
import { StreakFlameVariant } from '../types';

export const PlanktonGraphic = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className}>
    <motion.path
      d="M50 20 C30 20 20 40 20 60 C20 80 40 90 50 90 C60 90 80 80 80 60 C80 40 70 20 50 20"
      fill="#4ade80"
      animate={{ scale: [1, 1.1, 1] }}
      transition={{ duration: 2, repeat: Infinity }}
    />
    <circle cx="40" cy="45" r="5" fill="white" />
    <circle cx="60" cy="45" r="5" fill="white" />
    <circle cx="40" cy="45" r="2" fill="black" />
    <circle cx="60" cy="45" r="2" fill="black" />
    <path d="M40 70 Q50 80 60 70" stroke="black" strokeWidth="2" fill="none" />
    <path d="M50 20 L50 5" stroke="#4ade80" strokeWidth="4" />
    <path d="M50 5 L40 0" stroke="#4ade80" strokeWidth="2" />
    <path d="M50 5 L60 0" stroke="#4ade80" strokeWidth="2" />
  </svg>
);

export const KrillGraphic = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className}>
    <motion.path
      d="M20 50 Q40 30 80 50 Q40 70 20 50"
      fill="#f87171"
      animate={{ x: [0, 5, 0] }}
      transition={{ duration: 0.5, repeat: Infinity }}
    />
    <circle cx="70" cy="45" r="3" fill="black" />
    {[...Array(6)].map((_, i) => (
      <path key={`streak-${i}`} d={`M${30 + i * 8} 55 L${25 + i * 8} 65`} stroke="#f87171" strokeWidth="2" />
    ))}
  </svg>
);

export const SardineGraphic = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className}>
    <path d="M10 50 Q30 35 70 45 L90 35 L85 50 L90 65 L70 55 Q30 65 10 50" fill="#94a3b8" />
    <circle cx="25" cy="48" r="3" fill="white" />
    <circle cx="25" cy="48" r="1" fill="black" />
    <path d="M40 45 Q50 40 60 45" stroke="#cbd5e1" strokeWidth="1" fill="none" />
  </svg>
);

export const SeahorseGraphic = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className}>
    <path d="M60 20 Q70 10 50 10 Q30 10 40 30 Q45 45 40 60 Q35 80 50 90 Q65 95 60 80 Q55 70 60 60 Q65 50 60 40" fill="#fbbf24" stroke="#d97706" strokeWidth="2" />
    <circle cx="45" cy="20" r="3" fill="black" />
    <path d="M60 40 L75 45 L60 50" fill="#fbbf24" />
  </svg>
);

export const FlyingFishGraphic = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className}>
    <path d="M10 50 Q40 30 80 50 Q40 70 10 50" fill="#60a5fa" />
    <motion.path 
      d="M40 40 L20 10 L60 35" 
      fill="#93c5fd" 
      animate={{ rotate: [0, -20, 0] }}
      transition={{ duration: 0.2, repeat: Infinity }}
    />
    <motion.path 
      d="M40 60 L20 90 L60 65" 
      fill="#93c5fd" 
      animate={{ rotate: [0, 20, 0] }}
      transition={{ duration: 0.2, repeat: Infinity }}
    />
    <circle cx="70" cy="48" r="3" fill="black" />
  </svg>
);

export const BarracudaGraphic = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 120 60" className={className}>
    <path d="M5 30 Q30 15 100 25 L115 10 L110 30 L115 50 L100 35 Q30 45 5 30" fill="#475569" />
    <path d="M10 30 L20 25 L20 35 Z" fill="white" />
    <circle cx="35" cy="25" r="3" fill="red" />
    <path d="M40 35 H80" stroke="#1e293b" strokeWidth="2" strokeDasharray="4 2" />
  </svg>
);

export const SharkGraphic = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 120 80" className={className}>
    <path d="M10 40 Q40 10 100 35 L115 20 L110 40 L115 60 L100 45 Q40 70 10 40" fill="#64748b" />
    <path d="M50 25 L65 5 L80 30" fill="#64748b" />
    <circle cx="30" cy="35" r="3" fill="black" />
    <path d="M20 45 Q30 50 40 45" stroke="white" strokeWidth="2" fill="none" />
    <path d="M45 35 V45 M55 35 V45 M65 35 V45" stroke="#475569" strokeWidth="2" />
  </svg>
);

export const WhaleGraphic = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 150 100" className={className}>
    <path d="M20 60 Q20 20 80 20 Q130 20 140 50 Q145 70 130 80 Q100 90 60 90 Q20 90 20 60" fill="#1d4ed8" />
    <path d="M140 50 L160 30 L160 70 L140 50" fill="#1d4ed8" />
    <circle cx="50" cy="50" r="5" fill="black" />
    <motion.path 
      d="M80 20 Q80 0 70 0 M80 20 Q80 0 90 0" 
      stroke="#60a5fa" 
      strokeWidth="3" 
      fill="none"
      animate={{ opacity: [0, 1, 0], y: [0, -10, -20] }}
      transition={{ duration: 2, repeat: Infinity }}
    />
  </svg>
);

export const SeaweedGraphic = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 100" className={className}>
    <motion.path
      d="M20 100 Q10 80 20 60 Q30 40 20 20 Q10 0 20 0"
      stroke="#15803d"
      strokeWidth="8"
      fill="none"
      strokeLinecap="round"
      animate={{ d: ["M20 100 Q10 80 20 60 Q30 40 20 20 Q10 0 20 0", "M20 100 Q30 80 20 60 Q10 40 20 20 Q30 0 20 0", "M20 100 Q10 80 20 60 Q30 40 20 20 Q10 0 20 0"] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    />
  </svg>
);

export const CoralGraphic = ({ className, color = "#ef4444" }: { className?: string, color?: string }) => (
  <svg viewBox="0 0 100 100" className={className}>
    <path
      d="M50 100 V70 M50 70 L30 50 M50 70 L70 50 M30 50 V30 M70 50 V30 M30 50 L10 40 M70 50 L90 40"
      stroke={color}
      strokeWidth="12"
      strokeLinecap="round"
      fill="none"
    />
    <circle cx="50" cy="70" r="6" fill={color} />
    <circle cx="30" cy="50" r="6" fill={color} />
    <circle cx="70" cy="50" r="6" fill={color} />
    <circle cx="10" cy="40" r="6" fill={color} />
    <circle cx="90" cy="40" r="6" fill={color} />
  </svg>
);

export const StreakFlameGraphic = ({ variant, className }: { variant: StreakFlameVariant; className?: string }) => {
  const svgProps = {
    viewBox: '0 0 24 24',
    className,
    role: 'img' as const,
    'aria-hidden': true as const,
    xmlns: 'http://www.w3.org/2000/svg',
  };
  switch (variant) {
    case 1:
      return (
        <svg {...svgProps}>
          <defs>
            <linearGradient id="sf1" x1="12" y1="22" x2="12" y2="13" gradientUnits="userSpaceOnUse">
              <stop stopColor="#7f1d1d" />
              <stop offset="0.4" stopColor="#7c2d12" />
              <stop offset="1" stopColor="#451a03" />
            </linearGradient>
          </defs>
          <g transform="translate(12, 22.5) scale(0.36) translate(-12, -18)">
            <path
              d="M12 21.85 Q8.5 21.1 8.4 17.2 Q8.35 15.2 9.35 13.85 Q9.85 13.1 10.65 13.35 Q11.15 12.95 11.75 13.55 Q12.15 13.15 12.85 13.45 Q14.05 14.1 14.25 16.4 Q14.45 19.2 13.35 20.85 Q12.75 21.65 12 21.85 Q11.1 22 10.2 21.35 Q9.6 20.9 9.35 19.8 Q9.1 18.5 9.55 17.4"
              fill="none"
              stroke="#57534e"
              strokeWidth="0.55"
              strokeLinecap="round"
              opacity="0.65"
            />
            <path
              d="M12 21.85 Q8.5 21.1 8.4 17.2 Q8.35 15.2 9.35 13.85 Q9.85 13.1 10.65 13.35 Q11.15 12.95 11.75 13.55 Q12.15 13.15 12.85 13.45 Q14.05 14.1 14.25 16.4 Q14.45 19.2 13.35 20.85 Q12.75 21.65 12 21.85 Z"
              fill="url(#sf1)"
            />
            <ellipse cx="11.25" cy="21.55" rx="1.15" ry="0.42" fill="#92400e" opacity="0.5" />
          </g>
        </svg>
      );
    case 2:
      return (
        <svg {...svgProps}>
          <defs>
            <linearGradient id="sf2o" x1="12" y1="22" x2="12" y2="9" gradientUnits="userSpaceOnUse">
              <stop stopColor="#9a3412" />
              <stop offset="0.45" stopColor="#c2410c" />
              <stop offset="1" stopColor="#ea580c" />
            </linearGradient>
            <linearGradient id="sf2i" x1="12" y1="20.5" x2="12" y2="11" gradientUnits="userSpaceOnUse">
              <stop stopColor="#c2410c" stopOpacity="0.95" />
              <stop offset="1" stopColor="#fdba74" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          <g transform="translate(12, 22) scale(0.52) translate(-12, -16.5)">
            <path
              d="M12 22 Q7.2 20.6 7.35 15.4 Q7.55 11.2 10.15 9.65 Q11 9.05 12 9.75 Q13 9.05 13.85 9.65 Q16.45 11.2 16.65 15.4 Q16.8 20.6 12 22 Z"
              fill="url(#sf2o)"
            />
            <path
              d="M12 20.6 Q9.15 19.35 9.55 15.6 Q9.95 12.35 12 11.65 Q14.05 12.35 14.45 15.6 Q14.85 19.35 12 20.6 Z"
              fill="url(#sf2i)"
            />
          </g>
        </svg>
      );
    case 3:
      return (
        <svg {...svgProps}>
          <defs>
            <linearGradient id="sf3o" x1="12" y1="22" x2="12" y2="4" gradientUnits="userSpaceOnUse">
              <stop stopColor="#b91c1c" />
              <stop offset="0.35" stopColor="#ea580c" />
              <stop offset="0.72" stopColor="#f97316" />
              <stop offset="1" stopColor="#fb923c" />
            </linearGradient>
            <linearGradient id="sf3m" x1="12" y1="21" x2="12" y2="7" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fb923c" />
              <stop offset="1" stopColor="#fbbf24" />
            </linearGradient>
          </defs>
          <path
            d="M12 22 C6.2 21.4 4 16.8 4 12.4 C4 8.4 6.35 4.6 9.55 3.75 C10.55 3.45 11.25 4.35 12 6 C12.75 4.35 13.45 3.45 14.45 3.75 C17.65 4.6 20 8.4 20 12.4 C20 16.8 17.8 21.4 12 22 Z"
            fill="url(#sf3o)"
          />
          <path
            d="M12 20.4 C8.2 19.85 6.85 16.2 7.35 12.8 C7.85 9.5 9.85 7.05 12 6.45 C14.15 7.05 16.15 9.5 16.65 12.8 C17.15 16.2 15.8 19.85 12 20.4 Z"
            fill="url(#sf3m)"
          />
          <path
            d="M12 18 Q9.85 16.9 10.15 13.2 Q10.45 10.2 12 9.55 Q13.55 10.2 13.85 13.2 Q14.15 16.9 12 18 Z"
            fill="#fde047"
            opacity="0.92"
          />
        </svg>
      );
    case 4:
      return (
        <svg {...svgProps}>
          <defs>
            <linearGradient id="sf4o" x1="12" y1="22" x2="12" y2="2" gradientUnits="userSpaceOnUse">
              <stop stopColor="#dc2626" />
              <stop offset="0.38" stopColor="#f97316" />
              <stop offset="0.78" stopColor="#fb923c" />
              <stop offset="1" stopColor="#fbbf24" />
            </linearGradient>
            <linearGradient id="sf4c" x1="12" y1="20" x2="12" y2="5" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fb923c" />
              <stop offset="0.55" stopColor="#fde047" />
              <stop offset="1" stopColor="#fef9c3" />
            </linearGradient>
          </defs>
          <path
            d="M12 22 C5.2 20.8 3 14.5 3.5 10 C4 5.8 7.1 2.2 10.1 1.85 C10.95 1.65 11.35 3.1 12 5.6 C12.65 3.1 13.05 1.65 13.9 1.85 C16.9 2.2 20 5.8 20.5 10 C21 14.5 18.8 20.8 12 22 Z"
            fill="url(#sf4o)"
          />
          <path
            d="M12 20.15 C7.4 19.35 6 14.8 6.5 11.2 C7 7.6 9.45 4.65 12 4.05 C14.55 4.65 17 7.6 17.5 11.2 C18 14.8 16.6 19.35 12 20.15 Z"
            fill="url(#sf4c)"
          />
          <path
            d="M12 17.2 Q9.35 15.6 9.75 11.5 Q10.15 7.8 12 7.05 Q13.85 7.8 14.25 11.5 Q14.65 15.6 12 17.2 Z"
            fill="#fffbeb"
            opacity="0.95"
          />
          <path
            d="M15.4 17.8 Q17.35 15.9 16.85 12.6 Q16.45 10.2 14.95 11.4 Q15.25 14.2 15.4 17.8 Z"
            fill="#f97316"
            opacity="0.88"
          />
        </svg>
      );
    case 5:
      return (
        <svg {...svgProps}>
          <defs>
            <linearGradient id="sf5o" x1="12" y1="22" x2="12" y2="0" gradientUnits="userSpaceOnUse">
              <stop stopColor="#991b1b" />
              <stop offset="0.22" stopColor="#ef4444" />
              <stop offset="0.5" stopColor="#f97316" />
              <stop offset="0.78" stopColor="#fde047" />
              <stop offset="1" stopColor="#fff7ed" />
            </linearGradient>
            <linearGradient id="sf5c" x1="12" y1="20" x2="12" y2="2.5" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fed7aa" />
              <stop offset="0.45" stopColor="#fef08a" />
              <stop offset="1" stopColor="#ffffff" />
            </linearGradient>
            <filter id="sf5glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="0.85" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            d="M12 22 C3.8 20.2 1.5 12.5 2.85 7.8 C4.1 3.5 7.8 0.35 11 0.5 C11.75 0.45 12.15 2.4 12 5.2 C12.85 2.4 13.25 0.45 14 0.5 C17.2 0.35 20.9 3.5 22.15 7.8 C23.5 12.5 21.2 20.2 12 22 Z"
            fill="#fb923c"
            opacity="0.55"
            filter="url(#sf5glow)"
          />
          <path
            d="M12 22 C4.5 20.5 2.5 13.2 3.75 8.8 C4.9 4.8 8.2 1.6 11.15 1.75 C11.9 1.7 12.25 3.5 12 6.4 C12.75 3.5 13.1 1.7 13.85 1.75 C16.8 1.6 20.1 4.8 21.25 8.8 C22.5 13.2 20.5 20.5 12 22 Z"
            fill="url(#sf5o)"
          />
          <path
            d="M12 20.35 C6.9 19.4 5.4 13.6 6.05 9.9 C6.7 6.3 9.1 3.35 12 2.7 C14.9 3.35 17.3 6.3 17.95 9.9 C18.6 13.6 17.1 19.4 12 20.35 Z"
            fill="url(#sf5c)"
          />
          <path
            d="M12 17.4 Q8.2 15.7 8.75 10.2 Q9.25 6 12 5.15 Q14.75 6 15.25 10.2 Q15.8 15.7 12 17.4 Z"
            fill="#ffffff"
            opacity="0.93"
          />
          <path
            d="M7.6 18.8 Q4.9 16.2 5.35 10.8 Q5.75 7.2 8.15 8.35 Q7.7 13.5 7.6 18.8 Z"
            fill="#f97316"
            opacity="0.92"
          />
          <path
            d="M16.4 18.8 Q19.1 16.2 18.65 10.8 Q18.25 7.2 15.85 8.35 Q16.3 13.5 16.4 18.8 Z"
            fill="#f97316"
            opacity="0.92"
          />
        </svg>
      );
    default:
      return <svg {...svgProps} />;
  }
};

export const GraphicMap: Record<string, React.FC<{ className?: string }>> = {
  Plankton: PlanktonGraphic,
  Krill: KrillGraphic,
  Sardine: SardineGraphic,
  Seahorse: SeahorseGraphic,
  "Flying Fish": FlyingFishGraphic,
  Barracuda: BarracudaGraphic,
  "Great White Shark": SharkGraphic,
  "Blue Whale": WhaleGraphic,
};
