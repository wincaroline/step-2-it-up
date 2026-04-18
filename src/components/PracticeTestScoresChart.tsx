import React, { useId, useMemo } from 'react';
import { publicAsset, type PracticeTestChartEntry } from '../utils';

const SALMON_SRC = publicAsset('assets/graphic_surfingsalmon.webp');

/** Y position for tests without a logged score */
export const PRACTICE_TEST_PLACEHOLDER_SCORE = 220;

/** Left layout: score title band | 8px gap | Y tick numerals | plot area */
const SCORE_LABEL_BAND = 28;
const GAP_SCORE_TO_GRAPH = 8;
const Y_TICK_LABEL_BAND = 28;

export type PracticeTestChartPress = {
  dateKey: string;
  testNumber: number;
  score: number | null;
  isLatest: boolean;
};

export type PracticeTestScoresChartProps = {
  series: PracticeTestChartEntry[];
  /** When set, this point’s row/dot is emphasized (e.g. newest score). */
  highlightDateKey?: string;
  /** Bright glow behind salmon (e.g. score beat previous test). */
  salmonGlow?: boolean;
  /** If omitted, chart is display-only (e.g. inside another modal). */
  onPointPress?: (payload: PracticeTestChartPress) => void;
  className?: string;
};

type LayoutPoint = {
  x: number;
  y: number;
  score: number | null;
  testNumber: number;
  dateKey: string;
  missing: boolean;
};

export const PracticeTestScoresChart: React.FC<PracticeTestScoresChartProps> = ({
  series,
  highlightDateKey,
  salmonGlow = false,
  onPointPress,
  className = '',
}) => {
  const gradId = useId().replace(/:/g, '');
  const filterId = `${gradId}-glow`;

  const layout = useMemo(() => {
    const w = 480;
    const h = 208;
    const padL = SCORE_LABEL_BAND + GAP_SCORE_TO_GRAPH + Y_TICK_LABEL_BAND;
    const padR = 12;
    const padT = 28;
    const padB = 46;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;

    if (series.length === 0) {
      return {
        w,
        h,
        padL,
        padR,
        padT,
        padB,
        innerW,
        innerH,
        points: [] as LayoutPoint[],
        linePath: '',
        dottedBridgeSegments: [] as { x1: number; y1: number; x2: number; y2: number }[],
        minY: 0,
        maxY: 300,
        yTicks: [200, 220, 240, 260],
        scoreLabelCy: padT + innerH / 2,
        scoreLabelX: SCORE_LABEL_BAND / 2,
      };
    }

    const numeric = series.map((s) => s.score).filter((v): v is number => v !== null);
    const hasMissing = series.some((s) => s.score === null);

    let dataMin = numeric.length ? Math.min(...numeric) : PRACTICE_TEST_PLACEHOLDER_SCORE;
    let dataMax = numeric.length ? Math.max(...numeric) : PRACTICE_TEST_PLACEHOLDER_SCORE;
    if (hasMissing) {
      dataMin = Math.min(dataMin, PRACTICE_TEST_PLACEHOLDER_SCORE);
      dataMax = Math.max(dataMax, PRACTICE_TEST_PLACEHOLDER_SCORE);
    }

    let minY: number;
    let maxY: number;
    if (dataMin === dataMax) {
      minY = dataMin - 10;
      maxY = dataMax + 10;
    } else {
      maxY = dataMax + 10;
      const spanBeforeBottomPad = maxY - dataMin;
      minY = dataMin - Math.max(spanBeforeBottomPad * 0.06, 5);
    }

    const testNums = series.map((s) => s.testNumber);
    const minDomain = Math.min(...testNums);
    const maxDomain = Math.max(...testNums) + 1;
    const tnSpan = Math.max(1, maxDomain - minDomain);

    const xScaleTn = (tn: number) => padL + innerW * ((tn - minDomain) / tnSpan);
    const yScale = (v: number) => padT + innerH * (1 - (v - minY) / (maxY - minY));

    const points: LayoutPoint[] = series.map((s) => {
      const val = s.score !== null ? s.score : PRACTICE_TEST_PLACEHOLDER_SCORE;
      return {
        x: xScaleTn(s.testNumber),
        y: yScale(val),
        score: s.score,
        testNumber: s.testNumber,
        dateKey: s.dateKey,
        missing: s.score === null,
      };
    });

    const lineParts: string[] = [];
    for (let i = 0; i < series.length - 1; i++) {
      if (series[i].score !== null && series[i + 1].score !== null) {
        const a = points[i];
        const b = points[i + 1];
        if (lineParts.length === 0) {
          lineParts.push(`M ${a.x.toFixed(2)} ${a.y.toFixed(2)}`);
        }
        lineParts.push(`L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`);
      }
    }
    const linePath = lineParts.join(' ');

    /** Connect each missing-score (?) marker to its neighbors — dotted / implied trend to ~220 */
    const dottedBridgeSegments: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const bridgeKeys = new Set<string>();
    const pushBridge = (a: LayoutPoint, b: LayoutPoint) => {
      const key = [a.dateKey, b.dateKey].sort().join('|');
      if (bridgeKeys.has(key)) return;
      bridgeKeys.add(key);
      dottedBridgeSegments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    };
    for (let i = 0; i < points.length; i++) {
      if (!points[i].missing) continue;
      if (i > 0) pushBridge(points[i - 1], points[i]);
      if (i < points.length - 1) pushBridge(points[i], points[i + 1]);
    }

    const tickCount = 4;
    const yTicks: number[] = [];
    for (let t = 0; t <= tickCount; t++) {
      yTicks.push(minY + (t / tickCount) * (maxY - minY));
    }

    return {
      w,
      h,
      padL,
      padR,
      padT,
      padB,
      innerW,
      innerH,
      points,
      linePath,
      dottedBridgeSegments,
      minY,
      maxY,
      yTicks,
      scoreLabelCy: padT + innerH / 2,
      scoreLabelX: SCORE_LABEL_BAND / 2,
    };
  }, [series]);

  const latestDateKey = series.length ? series[series.length - 1].dateKey : '';
  const restPoints = layout.points.slice(0, -1);
  const last = layout.points[layout.points.length - 1];
  const salmonSize = 44;
  const scoreLabelX = layout.scoreLabelX;
  const scoreLabelCy = layout.scoreLabelCy;
  const interactive = Boolean(onPointPress);

  const pointHoverClassName = interactive
    ? 'transition-[filter] duration-200 ease-out motion-safe:hover:[filter:drop-shadow(0_0_12px_rgba(255,255,255,0.95))_drop-shadow(0_0_20px_rgba(103,232,249,0.55))] motion-safe:focus-visible:[filter:drop-shadow(0_0_12px_rgba(255,255,255,0.95))_drop-shadow(0_0_20px_rgba(103,232,249,0.55))] focus-visible:outline-none'
    : '';

  if (series.length === 0) {
    return (
      <div
        className={`rounded-2xl border-2 border-white/20 bg-white/5 px-4 py-8 text-center ${className}`}
      >
        <p className="text-sm font-bold text-white/70">
          Complete a practice test to see scores here.
        </p>
      </div>
    );
  }

  const firePress = (p: LayoutPoint) => {
    if (!onPointPress) return;
    onPointPress({
      dateKey: p.dateKey,
      testNumber: p.testNumber,
      score: p.score,
      isLatest: p.dateKey === latestDateKey,
    });
  };

  return (
    <div className={`relative w-full min-w-0 ${className}`}>
      <svg
        className="block h-auto w-full max-h-[260px] overflow-visible"
        viewBox={`0 0 ${layout.w} ${layout.h}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Practice test scores line chart"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
          <filter id={filterId} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
            </feMerge>
          </filter>
        </defs>

        <text
          x={scoreLabelX}
          y={scoreLabelCy}
          textAnchor="middle"
          dominantBaseline="middle"
          transform={`rotate(-90 ${scoreLabelX} ${scoreLabelCy})`}
          className="fill-white/70 font-black uppercase tracking-[0.2em]"
          style={{ fontSize: 10 }}
        >
          Score
        </text>

        {layout.yTicks.map((tick, i) => {
          const y = layout.padT + layout.innerH * (1 - i / (layout.yTicks.length - 1 || 1));
          return (
            <text
              key={`yt-${i}`}
              x={layout.padL - 4}
              y={y + 4}
              textAnchor="end"
              className="fill-white/55 text-[9px] font-black"
              style={{ fontSize: 9 }}
            >
              {Math.round(tick)}
            </text>
          );
        })}

        {layout.points.map((p) => (
          <text
            key={`xl-${p.dateKey}`}
            x={p.x}
            y={layout.h - 26}
            textAnchor="middle"
            className="fill-white/55 text-[9px] font-black"
            style={{ fontSize: 9 }}
          >
            {p.testNumber}
          </text>
        ))}

        <text
          x={layout.padL + layout.innerW / 2}
          y={layout.h - 8}
          textAnchor="middle"
          className="fill-white/70 font-black uppercase tracking-[0.2em]"
          style={{ fontSize: 10 }}
        >
          Test #
        </text>

        {layout.yTicks.map((_, i) => {
          const y = layout.padT + layout.innerH * (1 - i / (layout.yTicks.length - 1 || 1));
          return (
            <line
              key={`grid-${i}`}
              x1={layout.padL}
              y1={y}
              x2={layout.w - layout.padR}
              y2={y}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
          );
        })}

        {layout.dottedBridgeSegments.map((seg, idx) => (
          <line
            key={`bridge-${idx}`}
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            stroke="rgba(255,255,255,0.42)"
            strokeWidth={2}
            strokeDasharray="2 6"
            strokeLinecap="round"
            pointerEvents="none"
          />
        ))}

        {layout.linePath && (
          <path
            d={layout.linePath}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {restPoints.map((p) => {
          const isHi = highlightDateKey === p.dateKey;
          const pointer = interactive ? 'cursor-pointer' : '';

          if (p.missing) {
            return (
              <g
                key={p.dateKey}
                role={interactive ? 'button' : undefined}
                tabIndex={interactive ? 0 : undefined}
                className={`${pointer} ${pointHoverClassName}`}
                onClick={(e) => {
                  e.stopPropagation();
                  firePress(p);
                }}
                onKeyDown={(e) => {
                  if (!interactive) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    firePress(p);
                  }
                }}
              >
                <circle cx={p.x} cy={p.y} r={18} fill="transparent" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={12}
                  fill="rgba(15,23,42,0.85)"
                  stroke="white"
                  strokeWidth={2}
                />
                <text
                  x={p.x}
                  y={p.y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-amber-200 font-black"
                  style={{ fontSize: 16, pointerEvents: 'none' }}
                >
                  ?
                </text>
                <title>{`Test ${p.testNumber}: score not entered — tap to add`}</title>
              </g>
            );
          }

          return (
            <g
              key={p.dateKey}
              role={interactive ? 'button' : undefined}
              tabIndex={interactive ? 0 : undefined}
              className={`${pointer} ${pointHoverClassName}`}
              onClick={(e) => {
                e.stopPropagation();
                firePress(p);
              }}
              onKeyDown={(e) => {
                if (!interactive) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  firePress(p);
                }
              }}
            >
              <circle cx={p.x} cy={p.y} r={18} fill="transparent" />
              <circle
                cx={p.x}
                cy={p.y}
                r={isHi ? 8 : 6}
                fill={isHi ? '#fef08a' : '#67e8f9'}
                stroke="white"
                strokeWidth={isHi ? 3 : 2}
                style={{ pointerEvents: 'none' }}
              />
              <title>{`Test ${p.testNumber}: ${p.score} — tap to edit`}</title>
            </g>
          );
        })}

        {last && (
          <g
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            className={interactive ? `cursor-pointer ${pointHoverClassName}` : ''}
            onClick={(e) => {
              if (!interactive) return;
              e.stopPropagation();
              firePress(last);
            }}
            onKeyDown={(e) => {
              if (!interactive) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                firePress(last);
              }
            }}
          >
            {/* Hit region: dot + salmon stack */}
            <ellipse
              cx={last.x}
              cy={last.y - salmonSize / 2 - 2}
              rx={Math.max(salmonSize * 0.85, 28)}
              ry={salmonSize + 28}
              fill="transparent"
            />
            {last.missing ? (
              <>
                <circle
                  cx={last.x}
                  cy={last.y}
                  r={12}
                  fill="rgba(15,23,42,0.85)"
                  stroke="white"
                  strokeWidth={2}
                  style={{ pointerEvents: 'none' }}
                />
                <text
                  x={last.x}
                  y={last.y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-amber-200 font-black"
                  style={{ fontSize: 16, pointerEvents: 'none' }}
                >
                  ?
                </text>
              </>
            ) : (
              <>
                <circle
                  cx={last.x}
                  cy={last.y}
                  r={highlightDateKey === last.dateKey ? 8 : 6}
                  fill={highlightDateKey === last.dateKey ? '#fef08a' : '#67e8f9'}
                  stroke="white"
                  strokeWidth={highlightDateKey === last.dateKey ? 3 : 2}
                  style={{ pointerEvents: 'none' }}
                />
              </>
            )}
            <g transform={`translate(${last.x - salmonSize / 2}, ${last.y - salmonSize - 8})`} style={{ pointerEvents: 'none' }}>
              {salmonGlow && (
                <ellipse
                  cx={salmonSize / 2}
                  cy={salmonSize / 2 + 4}
                  rx={salmonSize * 0.65}
                  ry={salmonSize * 0.55}
                  fill="white"
                  opacity={0.95}
                  filter={`url(#${filterId})`}
                />
              )}
              <image
                href={SALMON_SRC}
                x={0}
                y={0}
                width={salmonSize}
                height={salmonSize}
                preserveAspectRatio="xMidYMid meet"
              />
            </g>
            <title>
              {last.missing ? 'Add score for latest test' : `${last.score} — latest practice test`}
            </title>
          </g>
        )}
      </svg>
    </div>
  );
};
