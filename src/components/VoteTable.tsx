import React from 'react';
import { QueryResult } from '../knn/types';
import { COLORS, NAMES } from '../knn/engine';
import { Radar, ArrowRight, Eye, Activity } from 'lucide-react';

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
  /* ── Standby bar when not revealed ── */
  if (!query || !revealed) {
    return (
      <div className="w-full flex-none h-10 bg-[#0d1424] rounded-xl border border-slate-800/60 px-4 flex items-center justify-between gap-3 text-xs shadow-sm ring-1 ring-white/[0.03] select-none">
        <div className="flex items-center gap-2 text-amber-400/90 font-medium truncate min-w-0">
          <Radar className="w-3.5 h-3.5 flex-none" />
          <span className="truncate text-[11px] font-mono">
            {hoverInfo || 'Hover over the arena to inspect distance & rank in real-time'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-500 text-[11px] flex-none">
          <Eye className="w-3 h-3 flex-none" />
          <span className="hidden sm:inline">
            Choose class&nbsp;
            <kbd className="px-1 py-0.5 bg-slate-800 text-slate-400 font-mono text-[9px] rounded border border-slate-700/60">1–{C}</kbd>
            &nbsp;to reveal
          </span>
        </div>
      </div>
    );
  }

  const { idx, d, pk, pw, w } = query;
  const sumW = w.reduce((acc, val) => acc + val, 0) || 1e-9;

  /* Tally votes */
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
    <div className="w-full flex-none bg-[#0d1424] rounded-xl border border-slate-800/60 flex flex-col overflow-hidden text-xs shadow-sm ring-1 ring-white/[0.03] select-none"
         style={{ height: 'clamp(160px, 19vh, 210px)' }}>

      {/* Header bar */}
      <div className="flex-none px-3 py-2 bg-slate-950/60 border-b border-slate-800/50 flex items-center justify-between gap-2">
        {/* Left: Hover info */}
        <div className="flex items-center gap-1.5 text-amber-400/90 font-mono font-medium truncate min-w-0">
          <Activity className="w-3 h-3 flex-none" />
          <span className="truncate text-[11px]">
            {hoverInfo || 'Hover canvas to inspect'}
          </span>
        </div>

        {/* Right: Vote summaries */}
        <div className="flex items-center gap-2.5 flex-none">
          {/* kNN */}
          <div className="flex items-center gap-1">
            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">kNN</span>
            {Array.from({ length: C }).map((_, c) => {
              const delta = isWedge && baseTotals ? counts[c] - baseTotals.counts[c] : 0;
              return (
                <span
                  key={c}
                  className="px-1.5 py-0.5 rounded-md font-bold text-[10px] font-mono"
                  style={{ backgroundColor: `${COLORS[c]}18`, color: COLORS[c] }}
                >
                  {NAMES[c][0]}:{counts[c]}
                  {isWedge && baseTotals && Math.abs(delta) > 1e-9 && (
                    <span className="ml-0.5 text-[9px] opacity-75">{delta > 0 ? `+${delta}` : delta}</span>
                  )}
                </span>
              );
            })}
            <ArrowRight className="w-2.5 h-2.5 text-slate-600" />
            <span className="font-bold px-1.5 py-0.5 rounded-md text-[10px]" style={{ backgroundColor: `${COLORS[pk]}22`, color: COLORS[pk] }}>
              {NAMES[pk]}
            </span>
          </div>

          <span className="w-px h-4 bg-slate-800" />

          {/* wkNN */}
          <div className="flex items-center gap-1">
            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">wkNN</span>
            {Array.from({ length: C }).map((_, c) => {
              const delta = isWedge && baseTotals ? weights[c] - baseTotals.weights[c] : 0;
              return (
                <span
                  key={c}
                  className="px-1.5 py-0.5 rounded-md font-bold text-[10px] font-mono"
                  style={{ backgroundColor: `${COLORS[c]}18`, color: COLORS[c] }}
                >
                  {NAMES[c][0]}:{weights[c].toFixed(1)}
                  {isWedge && baseTotals && Math.abs(delta) > 1e-9 && (
                    <span className="ml-0.5 text-[9px] opacity-75">{delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}</span>
                  )}
                </span>
              );
            })}
            <ArrowRight className="w-2.5 h-2.5 text-slate-600" />
            <span className="font-bold px-1.5 py-0.5 rounded-md text-[10px]" style={{ backgroundColor: `${COLORS[pw]}22`, color: COLORS[pw] }}>
              {NAMES[pw]}
            </span>
          </div>
        </div>
      </div>

      {/* Neighbor table */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-950/80 sticky top-0">
            <tr className="text-[10px] uppercase tracking-wider text-slate-600 border-b border-slate-800/50">
              <th className="py-1 px-3 text-center font-semibold w-8">#</th>
              <th className="py-1 px-3 font-semibold">Class</th>
              <th className="py-1 px-3 text-right font-semibold">Distance</th>
              <th className="py-1 px-3 text-right font-semibold">Weight</th>
              <th className="py-1 px-3 text-right font-semibold">Share</th>
              <th className="py-1 px-3 text-center font-semibold">Source</th>
            </tr>
          </thead>
          <tbody>
            {idx.map((trainIdx, r) => {
              const cls = ytr[trainIdx];
              const distVal = d[r];
              const weightVal = w[r];
              const sharePercent = Math.round((weightVal / sumW) * 100);
              const isMine = trainIdx >= nBase;

              return (
                <tr
                  key={r}
                  className="hover:bg-slate-800/30 transition-colors border-b border-slate-800/30 last:border-0"
                >
                  <td className="py-1 px-3 text-center font-mono text-[11px] font-bold text-slate-600">
                    {r + 1}
                  </td>
                  <td className="py-1 px-3">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[11px]">
                      <span
                        className="w-2 h-2 rounded-full flex-none"
                        style={{ backgroundColor: COLORS[cls] }}
                      />
                      <span style={{ color: COLORS[cls] }}>{NAMES[cls]}</span>
                    </span>
                  </td>
                  <td className="py-1 px-3 text-right font-mono text-[11px] text-slate-400">
                    {distVal.toFixed(3)}
                  </td>
                  <td className="py-1 px-3 text-right font-mono text-[11px] text-slate-300">
                    {weightVal.toFixed(3)}
                  </td>
                  <td className="py-1 px-3 text-right">
                    <div className="inline-flex items-center gap-1.5 justify-end">
                      <div className="w-10 h-1 bg-slate-800/80 rounded-full overflow-hidden hidden sm:block">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, sharePercent)}%`,
                            backgroundColor: COLORS[cls],
                          }}
                        />
                      </div>
                      <span className="font-mono text-[11px] text-slate-200 w-8 text-right">{sharePercent}%</span>
                    </div>
                  </td>
                  <td className="py-1 px-3 text-center">
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[9px] font-semibold ${
                        isMine
                          ? 'bg-violet-500/15 text-violet-300 border border-violet-500/30'
                          : 'bg-slate-800/50 text-slate-500'
                      }`}
                    >
                      {isMine ? 'yours ✦' : 'base'}
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
