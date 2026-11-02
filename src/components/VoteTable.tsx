import React from 'react';
import { QueryResult } from '../knn/types';
import { COLORS, NAMES } from '../knn/engine';
import { Radar, ArrowRight, Eye } from 'lucide-react';

interface VoteTableProps {
  query: QueryResult | null;
  revealed: boolean;
  ytr: number[];
  nBase: number;
  C: number;
  hoverInfo: string;
  baseTotals: { counts: number[]; weights: number[] } | null;
  isWedge: boolean;
}

export const VoteTable: React.FC<VoteTableProps> = ({
  query,
  revealed,
  ytr,
  nBase,
  C,
  hoverInfo,
  baseTotals,
  isWedge,
}) => {
  // If no query or unrevealed in Play mode, show compact standby inspector
  if (!query || !revealed) {
    return (
      <div className="w-full flex-none h-[38px] bg-[#0e1420] rounded-lg border border-slate-800/80 px-3 flex items-center justify-between text-xs font-mono shadow-sm select-none">
        {/* Telemetry live cursor readout */}
        <div className="flex items-center gap-1.5 text-amber-400 font-medium truncate max-w-[60%]">
          <Radar className="w-3.5 h-3.5 flex-none" />
          <span className="truncate text-[11px]">
            {hoverInfo || 'Move cursor over the arena to inspect distance & rank in real-time'}
          </span>
        </div>

        {/* Prompt to guess */}
        <div className="flex items-center gap-2 text-slate-400 text-[11px] font-sans">
          <Eye className="w-3 h-3 text-slate-500" />
          <span>
            Choose your answer above (keys <kbd className="px-1 py-0.2 bg-slate-800 text-slate-300 font-mono text-[10px] rounded border border-slate-700">1-{C}</kbd>) to reveal neighbor breakdown
          </span>
        </div>
      </div>
    );
  }

  const { idx, d, pk, pw, w } = query;
  const sumW = w.reduce((acc, val) => acc + val, 0) || 1e-9;

  // Calculate vote totals
  const counts = new Array(C).fill(0);
  const weights = new Array(C).fill(0);
  for (let i = 0; i < idx.length; i++) {
    const c = ytr[idx[i]];
    if (c >= 0 && c < C) {
      counts[c] += 1;
      weights[c] += w[i];
    }
  }

  return (
    <div className="w-full flex-none h-[165px] lg:h-[180px] xl:h-[195px] bg-[#0e1420] rounded-lg border border-slate-800/80 flex flex-col overflow-hidden text-xs font-mono shadow-sm select-none">
      {/* Telemetry & Summary Header */}
      <div className="flex-none px-3 py-1.5 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between gap-2 text-[11px]">
        {/* Left: Live cursor readout */}
        <div className="flex items-center gap-1.5 text-amber-400 font-medium truncate max-w-sm">
          <Radar className="w-3.5 h-3.5 flex-none" />
          <span className="truncate text-[11px]">
            {hoverInfo || 'Hover over canvas to inspect distance and rank'}
          </span>
        </div>

        {/* Right: Quick Totals & Winners */}
        <div className="flex items-center gap-3 flex-none">
          {/* kNN Summary */}
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-slate-400 uppercase text-[10px] font-bold">kNN:</span>
            {Array.from({ length: C }).map((_, c) => {
              const baseC = isWedge && baseTotals ? baseTotals.counts[c] : null;
              const delta = baseC !== null ? counts[c] - baseC : 0;
              return (
                <span
                  key={c}
                  className="px-1 py-0.2 rounded font-semibold text-[10px]"
                  style={{
                    backgroundColor: `${COLORS[c]}20`,
                    color: COLORS[c],
                  }}
                >
                  {NAMES[c][0]}:{counts[c]}
                  {isWedge && baseTotals && Math.abs(delta) > 1e-9 && (
                    <span className="ml-0.5 opacity-90 text-[9px]">
                      {delta > 0 ? `+${delta}` : delta}
                    </span>
                  )}
                </span>
              );
            })}
            <ArrowRight className="w-3 h-3 text-slate-500" />
            <span className="font-bold px-1.5 py-0.2 rounded text-[10px]" style={{ backgroundColor: `${COLORS[pk]}33`, color: COLORS[pk] }}>
              {NAMES[pk]}
            </span>
          </div>

          <span className="text-slate-700">|</span>

          {/* wkNN Summary */}
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-slate-400 uppercase text-[10px] font-bold">wkNN:</span>
            {Array.from({ length: C }).map((_, c) => {
              const baseW = isWedge && baseTotals ? baseTotals.weights[c] : null;
              const delta = baseW !== null ? weights[c] - baseW : 0;
              return (
                <span
                  key={c}
                  className="px-1 py-0.2 rounded font-semibold text-[10px]"
                  style={{
                    backgroundColor: `${COLORS[c]}20`,
                    color: COLORS[c],
                  }}
                >
                  {NAMES[c][0]}:{weights[c].toFixed(1)}
                  {isWedge && baseTotals && Math.abs(delta) > 1e-9 && (
                    <span className="ml-0.5 opacity-90 text-[9px]">
                      {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
                    </span>
                  )}
                </span>
              );
            })}
            <ArrowRight className="w-3 h-3 text-slate-500" />
            <span className="font-bold px-1.5 py-0.2 rounded text-[10px]" style={{ backgroundColor: `${COLORS[pw]}33`, color: COLORS[pw] }}>
              {NAMES[pw]}
            </span>
          </div>
        </div>
      </div>

      {/* Neighbor Votes Table */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-950/90 sticky top-0 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
            <tr>
              <th className="py-1 px-3 text-center w-10">#</th>
              <th className="py-1 px-3">Class</th>
              <th className="py-1 px-3 text-right">Distance</th>
              <th className="py-1 px-3 text-right">wkNN weight</th>
              <th className="py-1 px-3 text-right">Share of wkNN</th>
              <th className="py-1 px-3 text-center">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40 text-[11px]">
            {idx.map((trainIdx, r) => {
              const cls = ytr[trainIdx];
              const distVal = d[r];
              const weightVal = w[r];
              const sharePercent = Math.round((weightVal / sumW) * 100);
              const isMine = trainIdx >= nBase;

              return (
                <tr
                  key={r}
                  className="hover:bg-slate-800/50 transition-colors"
                >
                  <td className="py-1 px-3 text-center font-bold text-slate-400">
                    {r + 1}
                  </td>
                  <td className="py-1 px-3">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[11px]">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: COLORS[cls] }}
                      />
                      <span style={{ color: COLORS[cls] }}>{NAMES[cls]}</span>
                    </span>
                  </td>
                  <td className="py-1 px-3 text-right font-medium text-slate-300">
                    {distVal.toFixed(3)}
                  </td>
                  <td className="py-1 px-3 text-right font-medium text-slate-200">
                    {weightVal.toFixed(3)}
                  </td>
                  <td className="py-1 px-3 text-right font-semibold text-slate-100">
                    <div className="inline-flex items-center gap-1.5 justify-end">
                      <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden hidden sm:block">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, sharePercent)}%`,
                            backgroundColor: COLORS[cls],
                          }}
                        />
                      </div>
                      <span className="w-8 text-right">{sharePercent}%</span>
                    </div>
                  </td>
                  <td className="py-1 px-3 text-center">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        isMine
                          ? 'bg-purple-900/60 text-purple-200 border border-purple-500/50'
                          : 'bg-slate-800/60 text-slate-400'
                      }`}
                    >
                      {isMine ? 'yours (✦)' : 'base'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
