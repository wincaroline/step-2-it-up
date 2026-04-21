import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';

const BUBBLE_DURATION_S = 5;
const BUBBLE_SLEEP_DURATION_S = 10;
const BUBBLE_RISE_PX = 500;
/** Normal horizontal wobble (px); sleep mode uses a softer path. */
const BUBBLE_WOBBLE_X: readonly number[] = [0, 9, -8, 7, -7, 6, -5, 0];
const BUBBLE_WOBBLE_X_SLEEP: readonly number[] = [0, 3, -3, 2.5, -2.5, 2, -2, 0];

function randomBubbleOrigin(): { leftPct: number; topPct: number } {
  return {
    leftPct: Math.random() * 100,
    topPct: 10 + Math.random() * 78,
  };
}

/** Sleep: fewer bubbles + longer gaps; first-rise delays spread by index so loads don’t clump. */
export const BUBBLE_COUNT_SLEEP = 16;
const BUBBLE_SLEEP_FIRST_SPREAD_S = 54;

/** One bubble: random spawn in the ocean layer, staggered timing, rise + fade + horizontal wobble. Sleep mode: slower rise, gentler wobble. */
export const Bubble = React.memo(function Bubble({
  sleepMode = false,
  staggerIndex = 0,
  bubbleCount = 40,
}: {
  sleepMode?: boolean;
  /** Used in sleep mode to spread first appearance across ~54s (avoids many bubbles starting together on load). */
  staggerIndex?: number;
  bubbleCount?: number;
}) {
  const size = useMemo(
    () => (sleepMode ? 10 + Math.random() * 22 : 4 + Math.random() * 16),
    [sleepMode]
  );
  const startDelaySec = useMemo(() => {
    if (sleepMode) {
      const denom = Math.max(bubbleCount - 1, 1);
      const slot = staggerIndex / denom;
      return slot * BUBBLE_SLEEP_FIRST_SPREAD_S + (Math.random() * 5 - 2.5);
    }
    return Math.random() * 14;
  }, [sleepMode, staggerIndex, bubbleCount]);
  const repeatGapSec = useMemo(
    () => (sleepMode ? 7 + Math.random() * 24 : 1.2 + Math.random() * 11),
    [sleepMode]
  );
  const durationSec = sleepMode ? BUBBLE_SLEEP_DURATION_S : BUBBLE_DURATION_S;
  const wobbleX = sleepMode ? BUBBLE_WOBBLE_X_SLEEP : BUBBLE_WOBBLE_X;
  const opacityKeyframes = sleepMode
    ? ([0, 0.42, 0.34, 0.26, 0.16, 0] as const)
    : ([0, 0.72, 0.58, 0.42, 0.24, 0] as const);

  const [origin, setOrigin] = useState(randomBubbleOrigin);
  const [session, setSession] = useState(0);
  const gapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (gapTimeoutRef.current != null) {
        clearTimeout(gapTimeoutRef.current);
      }
    },
    []
  );

  const handleRiseComplete = useCallback(() => {
    if (gapTimeoutRef.current != null) clearTimeout(gapTimeoutRef.current);
    gapTimeoutRef.current = setTimeout(() => {
      gapTimeoutRef.current = null;
      setOrigin(randomBubbleOrigin());
      setSession((s) => s + 1);
    }, repeatGapSec * 1000);
  }, [repeatGapSec]);

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${origin.leftPct}%`,
        top: `${origin.topPct}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <motion.div
        key={session}
        className={
          sleepMode
            ? 'rounded-full bg-white/25 border border-white/40 shadow-[inset_0_2px_4px_rgba(255,255,255,0.45)]'
            : 'rounded-full bg-white/40 border border-white/60 shadow-[inset_0_2px_4px_rgba(255,255,255,0.8)]'
        }
        initial={{ y: 0, x: 0, opacity: 0 }}
        animate={{
          y: -BUBBLE_RISE_PX,
          x: [...wobbleX],
          opacity: [...opacityKeyframes],
        }}
        transition={{
          duration: durationSec,
          delay: session === 0 ? startDelaySec : 0,
          y: { duration: durationSec, ease: 'easeOut' },
          x: {
            duration: durationSec,
            ease: 'easeInOut',
            times: [0, 0.14, 0.3, 0.46, 0.62, 0.77, 0.9, 1],
          },
          opacity: {
            duration: durationSec,
            ease: 'easeInOut',
            times: [0, 0.12, 0.3, 0.52, 0.78, 1],
          },
        }}
        onAnimationComplete={handleRiseComplete}
        style={{ width: size, height: size }}
      />
    </div>
  );
});

const SURGE_COAST_S = 0.3;
const SURGE_DECAY_S = 0.68;
const PEAK_SURGE_PX = 26;

function pctKey(t: number): string {
  return `${(t * 100).toFixed(4)}`;
}

export const SeaCreature = React.memo(function SeaCreature({
  graphic: _graphic,
  delay,
  y,
  sleepMode = false,
  warningMode = false,
}: {
  graphic: string;
  delay: number;
  y: string;
  sleepMode?: boolean;
  warningMode?: boolean;
}) {
  const animSafeId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  /** `delay` from App is stagger in seconds — map to 0–1 and use negative animation-delay for phase (no frozen wait). */
  const phase = useMemo(() => {
    const maxStaggerSec = 25;
    if (delay <= 0) return 0;
    return Math.min(1, delay / maxStaggerSec);
  }, [delay]);
  /** Sleep mode: slower drift forward; warning mode: brisk pass; normal: 15–25s with wiggle/surge. */
  const duration = useMemo(() => {
    if (sleepMode) return 22 + Math.random() * 14;
    if (warningMode) return 10 + Math.random() * 5;
    return 15 + Math.random() * 10;
  }, [sleepMode, warningMode]);
  const wiggleDuration = useMemo(() => 1.1 + Math.random() * 0.6, []);
  const wigglePause = useMemo(() => 1.8 + Math.random() * 1.6, []);

  const boostCycle = useMemo(() => {
    if (sleepMode || warningMode) return null;
    const tw = wiggleDuration;
    const total = tw + SURGE_COAST_S + SURGE_DECAY_S + wigglePause;
    const tW = tw / total;
    const tMidW = (tw * 0.45) / total;
    const tSurgeEnd = (tw + SURGE_COAST_S) / total;
    const tDecayEnd = (tw + SURGE_COAST_S + SURGE_DECAY_S) / total;

    const timesWiggle = [0, tW * 0.15, tW * 0.35, tW * 0.55, tW * 0.75, tW, 1] as const;

    return {
      total,
      timesSurgeX: [0, tMidW, tW, tSurgeEnd, tDecayEnd, 1] as const,
      surgeX: [0, 14, PEAK_SURGE_PX, PEAK_SURGE_PX, 0, 0] as const,
      timesWiggle: [...timesWiggle],
      rotate: [0, -6, 6, -4, 4, 0, 0] as const,
      yBob: [0, -1, 1, -1, 1, 0, 0] as const,
    };
  }, [sleepMode, warningMode, wiggleDuration, wigglePause]);

  const fishImageSrc = useMemo(() => {
    const base = import.meta.env.BASE_URL;
    if (sleepMode) {
      const sleepy = [`${base}assets/graphic_sleepyfish1.png`, `${base}assets/graphic_sleepyfish2.png`];
      return sleepy[Math.abs(Math.round(delay)) % sleepy.length];
    }
    if (warningMode) {
      const scaryFish = [
        `${base}assets/graphic_scaryfish1.png`,
        `${base}assets/graphic_scaryfish2.png`,
        `${base}assets/graphic_scaryfish3.png`,
      ];
      return scaryFish[Math.abs(Math.round(delay)) % scaryFish.length];
    }
    const fishImages = [`${base}assets/graphic_bgfish1.png`, `${base}assets/graphic_bgfish2.png`, `${base}assets/graphic_bgfish3.png`];
    const index = Math.abs(Math.round(delay)) % fishImages.length;
    return fishImages[index];
  }, [delay, sleepMode, warningMode]);

  /** Per-fish keyframes avoid Motion repeat / filter jank; timing matches boostCycle math. */
  const seaCreatureKeyframeCss = useMemo(() => {
    if (!boostCycle) return '';

    const {
      timesSurgeX,
      surgeX,
      timesWiggle,
      rotate,
      yBob,
    } = boostCycle;

    let css = `@keyframes sea-creature-surge-${animSafeId} {`;
    for (let i = 0; i < surgeX.length; i++) {
      css += `${pctKey(timesSurgeX[i])}% { transform: translate3d(${surgeX[i]}px, 0, 0); }`;
    }
    css += `} @keyframes sea-creature-wiggle-${animSafeId} {`;
    for (let i = 0; i < rotate.length; i++) {
      css += `${pctKey(timesWiggle[i])}% { transform: rotate(${rotate[i]}deg) translate3d(0, ${yBob[i]}px, 0); }`;
    }
    css += '}';
    return css;
  }, [animSafeId, boostCycle]);

  const swimVars = useMemo(
    () =>
      ({
        '--sea-creature-duration': `${duration}s`,
        '--sea-creature-phase': String(phase),
      }) as React.CSSProperties,
    [duration, phase]
  );

  const surgeVars = useMemo(
    () =>
      boostCycle
        ? ({
            '--boost-duration': `${boostCycle.total}s`,
          } as React.CSSProperties)
        : undefined,
    [boostCycle]
  );

  return (
    <div className="sea-creature-fade absolute pointer-events-none z-0" style={{ ...swimVars, top: y }}>
      <div className={`${warningMode ? 'sea-creature-swim-warning sea-creature-zigzag-warning' : 'sea-creature-swim'} inline-block`} style={swimVars}>
        {sleepMode ? (
          <img
            src={fishImageSrc}
            alt=""
            className="block h-[100px] w-auto object-contain opacity-35 grayscale brightness-125"
          />
        ) : warningMode ? (
          <img
            src={fishImageSrc}
            alt=""
            className="block h-[88px] w-auto object-contain opacity-35"
            style={{
              filter:
                'drop-shadow(0 0 8px rgba(239, 68, 68, 0.78)) drop-shadow(0 0 16px rgba(220, 38, 38, 0.58))',
            }}
          />
        ) : (
          <>
            <style>{seaCreatureKeyframeCss}</style>
            <div
              className="inline-block"
              style={{
                ...surgeVars,
                animationName: `sea-creature-surge-${animSafeId}`,
                animationDuration: 'var(--boost-duration)',
                animationTimingFunction: 'linear',
                animationIterationCount: 'infinite',
                animationDelay: 'calc(-1 * var(--sea-creature-phase) * var(--boost-duration))',
                animationFillMode: 'both',
                willChange: 'transform',
                backfaceVisibility: 'hidden',
              }}
            >
              <img
                src={fishImageSrc}
                alt=""
                className="block h-[60px] w-auto object-contain opacity-35 grayscale brightness-125"
                style={{
                  ...surgeVars,
                  animationName: `sea-creature-wiggle-${animSafeId}`,
                  animationDuration: 'var(--boost-duration)',
                  animationTimingFunction: 'ease-in-out',
                  animationIterationCount: 'infinite',
                  animationDelay: 'calc(-1 * var(--sea-creature-phase) * var(--boost-duration))',
                  animationFillMode: 'both',
                  willChange: 'transform',
                  backfaceVisibility: 'hidden',
                  transformOrigin: 'center center',
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
});
