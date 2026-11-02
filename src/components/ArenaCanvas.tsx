import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { AppMode, BackgroundMode, Metric, Point, QueryResult, WeightingScheme } from '../knn/types';
import { ballPoly, COLORS, dist, EPS, NAMES } from '../knn/engine';

interface ArenaCanvasProps {
  mode: AppMode;
  Xtr: Point[];
  ytr: number[];
  nBase: number;
  C: number;
  focus: { point: Point; truth: number | null } | null;
  revealed: boolean;
  k: number;
  metric: Metric;
  scheme: WeightingScheme;
  boundary: BackgroundMode;
  bounds: { lo: Point; hi: Point };
  cachedQuery: QueryResult | null;
  rMin?: number;
  ghosts?: { point: Point; cls: number }[];
  title?: string;
  onCanvasClick: (worldPt: Point, button: number) => void;
  onHoverMove: (worldPt: Point | null) => void;
}

export const ArenaCanvas: React.FC<ArenaCanvasProps> = ({
  mode,
  Xtr,
  ytr,
  nBase,
  C,
  focus,
  revealed,
  k,
  metric,
  scheme,
  boundary,
  bounds,
  cachedQuery,
  rMin,
  ghosts = [],
  title = '',
  onCanvasClick,
  onHoverMove,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 700,
    height: 500,
  });

  // Watch container dimensions with ResizeObserver to fill available space dynamically
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (container.clientWidth > 0 && container.clientHeight > 0) {
      setDimensions({ width: container.clientWidth, height: container.clientHeight });
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width: Math.round(width), height: Math.round(height) });
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Compute 1:1 aspect ratio preserving transform with internal margin and centering
  const getTransform = useCallback(
    (width: number, height: number) => {
      const padX = 14;
      const padTop = title ? 28 : 14;
      const padBottom = 14;
      const availW = Math.max(20, width - 2 * padX);
      const availH = Math.max(20, height - padTop - padBottom);
      const xSpan = bounds.hi[0] - bounds.lo[0] || 1;
      const ySpan = bounds.hi[1] - bounds.lo[1] || 1;
      const scale = Math.min(availW / xSpan, availH / ySpan);
      const offsetX = padX + (availW - xSpan * scale) / 2;
      const offsetY = padTop + (availH - ySpan * scale) / 2;
      return { scale, offsetX, offsetY, xSpan, ySpan };
    },
    [bounds, title]
  );

  // Helper: World to Canvas coordinates
  const worldToCanvas = useCallback(
    (pt: Point, width: number, height: number): [number, number] => {
      const { scale, offsetX, offsetY } = getTransform(width, height);
      const cx = offsetX + (pt[0] - bounds.lo[0]) * scale;
      const cy = offsetY + (bounds.hi[1] - pt[1]) * scale;
      return [cx, cy];
    },
    [bounds, getTransform]
  );

  // Helper: Canvas to World coordinates
  const canvasToWorld = useCallback(
    (cx: number, cy: number, width: number, height: number): Point => {
      const { scale, offsetX, offsetY } = getTransform(width, height);
      const wx = bounds.lo[0] + (cx - offsetX) / scale;
      const wy = bounds.hi[1] - (cy - offsetY) / scale;
      return [wx, wy];
    },
    [bounds, getTransform]
  );

  // Safe roundRect helper for environments/browsers lacking native ctx.roundRect
  const safeRoundRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.rect(x, y, w, h);
    }
  };

  // Draw 5-pointed star
  const drawStar = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    spikes: number,
    outerRadius: number,
    innerRadius: number
  ) => {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
  };

  // Generate background decision boundary heatmap on an offscreen canvas
  const bgCanvas = useMemo(() => {
    const canShowBg = mode === 'sandbox' || mode === 'wedge' || revealed;
    if (boundary === 'none' || !canShowBg || Xtr.length === 0) {
      return null;
    }

    const gridSize = 100;
    const off = document.createElement('canvas');
    off.width = gridSize;
    off.height = gridSize;
    const ctx = off.getContext('2d');
    if (!ctx) return null;

    const imgData = ctx.createImageData(gridSize, gridSize);
    const data = imgData.data;

    // Parse RGB for each class
    const classRgb = COLORS.slice(0, C).map((hex) => {
      const c = hex.replace('#', '');
      return [
        parseInt(c.substring(0, 2), 16),
        parseInt(c.substring(2, 4), 16),
        parseInt(c.substring(4, 6), 16),
      ];
    });

    const xSpan = bounds.hi[0] - bounds.lo[0];
    const ySpan = bounds.hi[1] - bounds.lo[1];
    const effectiveK = Math.min(k, Xtr.length);

    // Preallocated buffers
    const cellDists = new Float64Array(Xtr.length);
    const cellIdx = new Int32Array(Xtr.length);
    const topIdx = new Int32Array(effectiveK);
    const topD = new Float64Array(effectiveK);
    const votesK = new Float64Array(C);
    const votesW = new Float64Array(C);

    const checkKnn = boundary === 'knn' || boundary === 'disagree';
    const checkWknn = boundary === 'wknn' || boundary === 'disagree';

    for (let gy = 0; gy < gridSize; gy++) {
      const wy = bounds.lo[1] + (gy / (gridSize - 1)) * ySpan;
      const rowInImg = gridSize - 1 - gy;

      for (let gx = 0; gx < gridSize; gx++) {
        const wx = bounds.lo[0] + (gx / (gridSize - 1)) * xSpan;
        const pt: Point = [wx, wy];

        // 1. Distances to all training points
        for (let i = 0; i < Xtr.length; i++) {
          cellDists[i] = dist(pt, Xtr[i], metric);
          cellIdx[i] = i;
        }

        // 2. In-place partial selection sort for top-K
        for (let i = 0; i < effectiveK; i++) {
          let minIdx = i;
          for (let j = i + 1; j < Xtr.length; j++) {
            if (cellDists[j] < cellDists[minIdx]) minIdx = j;
          }
          if (minIdx !== i) {
            const td = cellDists[i];
            cellDists[i] = cellDists[minIdx];
            cellDists[minIdx] = td;
            const ti = cellIdx[i];
            cellIdx[i] = cellIdx[minIdx];
            cellIdx[minIdx] = ti;
          }
          topIdx[i] = cellIdx[i];
          topD[i] = cellDists[i];
        }

        // 3. Fast prediction
        let pk = 0;
        if (checkKnn) {
          votesK.fill(0);
          for (let i = 0; i < effectiveK; i++) {
            votesK[ytr[topIdx[i]]] += 1.0;
          }
          votesK[ytr[topIdx[0]]] += 1e-9;
          let maxK = votesK[0];
          for (let c = 1; c < C; c++) {
            if (votesK[c] > maxK) {
              maxK = votesK[c];
              pk = c;
            }
          }
        }

        let pw = 0;
        if (checkWknn) {
          votesW.fill(0);
          const h = (effectiveK > 0 ? topD[effectiveK - 1] : 0) + EPS;
          for (let i = 0; i < effectiveK; i++) {
            const distVal = topD[i];
            let w = 1.0;
            if (scheme === 'inverse') {
              w = 1.0 / (distVal + EPS);
            } else if (scheme === 'inverse_sq') {
              w = 1.0 / (distVal * distVal + EPS);
            } else if (scheme === 'gaussian') {
              w = Math.exp(-3.0 * Math.pow(distVal / h, 2));
            }
            votesW[ytr[topIdx[i]]] += w;
          }
          votesW[ytr[topIdx[0]]] += 1e-9;
          let maxW = votesW[0];
          for (let c = 1; c < C; c++) {
            if (votesW[c] > maxW) {
              maxW = votesW[c];
              pw = c;
            }
          }
        }

        const pixelIdx = (rowInImg * gridSize + gx) * 4;

        if (boundary === 'disagree') {
          if (pk !== pw) {
            data[pixelIdx] = 228;
            data[pixelIdx + 1] = 87;
            data[pixelIdx + 2] = 46;
            data[pixelIdx + 3] = Math.round(0.4 * 255);
          } else {
            data[pixelIdx + 3] = 0;
          }
        } else {
          const modelPred = boundary === 'knn' ? pk : pw;
          const [r, g, b] = classRgb[modelPred];
          data[pixelIdx] = r;
          data[pixelIdx + 1] = g;
          data[pixelIdx + 2] = b;
          data[pixelIdx + 3] = Math.round(0.24 * 255);
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return off;
  }, [boundary, mode, revealed, Xtr, ytr, C, bounds, k, metric, scheme]);

  // Main canvas render effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = dimensions.width;
    const height = dimensions.height;
    if (width <= 0 || height <= 0) return;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Deep slate background clear
    ctx.fillStyle = '#0a0e17';
    ctx.fillRect(0, 0, width, height);

    const { scale, offsetX, offsetY, xSpan, ySpan } = getTransform(width, height);
    const plotW = xSpan * scale;
    const plotH = ySpan * scale;

    // Background fill of the data arena
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(offsetX, offsetY, plotW, plotH);

    // 1. Draw heatmap boundary if active
    if (bgCanvas && plotW > 0 && plotH > 0) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(bgCanvas, offsetX, offsetY, plotW, plotH);
    }

    // Subtle grid lines strictly within the data arena
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;

    const xStep = 1.0;
    const minGridX = Math.ceil(bounds.lo[0] / xStep) * xStep;
    const maxGridX = Math.floor(bounds.hi[0] / xStep) * xStep;
    for (let gx = minGridX; gx <= maxGridX; gx += xStep) {
      const [cx] = worldToCanvas([gx, 0], width, height);
      if (cx >= offsetX - 0.5 && cx <= offsetX + plotW + 0.5) {
        ctx.beginPath();
        ctx.moveTo(cx, offsetY);
        ctx.lineTo(cx, offsetY + plotH);
        ctx.stroke();
      }
    }

    const yStep = 1.0;
    const minGridY = Math.ceil(bounds.lo[1] / yStep) * yStep;
    const maxGridY = Math.floor(bounds.hi[1] / yStep) * yStep;
    for (let gy = minGridY; gy <= maxGridY; gy += yStep) {
      const [, cy] = worldToCanvas([0, gy], width, height);
      if (cy >= offsetY - 0.5 && cy <= offsetY + plotH + 0.5) {
        ctx.beginPath();
        ctx.moveTo(offsetX, cy);
        ctx.lineTo(offsetX + plotW, cy);
        ctx.stroke();
      }
    }

    // 2. In Wedge mode: Draw no-go zone
    if (mode === 'wedge' && rMin && rMin > 0) {
      const center: Point = [0, 0];
      const zonePts = ballPoly(center, rMin, metric, 181);
      if (zonePts.length > 0) {
        ctx.beginPath();
        const [startX, startY] = worldToCanvas(zonePts[0], width, height);
        ctx.moveTo(startX, startY);
        for (let i = 1; i < zonePts.length; i++) {
          const [zx, zy] = worldToCanvas(zonePts[i], width, height);
          ctx.lineTo(zx, zy);
        }
        ctx.closePath();

        // Shaded fill
        ctx.fillStyle = 'rgba(71, 85, 105, 0.22)';
        ctx.fill();

        // Dotted border matching Python
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 3. Draw ghost hint markers if present
    if (ghosts && ghosts.length > 0) {
      for (const ghost of ghosts) {
        const [gx, gy] = worldToCanvas(ghost.point, width, height);
        ctx.save();
        ctx.translate(gx, gy);
        ctx.rotate(Math.PI / 4);
        ctx.strokeStyle = COLORS[ghost.cls];
        ctx.lineWidth = 2.2;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(-7, -7, 14, 14);
        ctx.restore();
      }
    }

    // 4. Draw rays and k-th neighbor contour if star is revealed/queried
    if (focus && cachedQuery && (revealed || mode === 'sandbox' || mode === 'wedge')) {
      const starPt = focus.point;
      const [starCx, starCy] = worldToCanvas(starPt, width, height);
      const { idx, d, w } = cachedQuery;

      const maxW = Math.max(...w, 1e-9);

      // Connecting ray lines
      for (let j = 0; j < idx.length; j++) {
        const trainIdx = idx[j];
        const trainPt = Xtr[trainIdx];
        const [tx, ty] = worldToCanvas(trainPt, width, height);

        const wNorm = w[j] / maxW;
        ctx.beginPath();
        ctx.moveTo(starCx, starCy);
        ctx.lineTo(tx, ty);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 0.6 + 2.8 * wNorm;
        ctx.stroke();
      }

      // Metric ball contour at k-th neighbor radius
      if (d.length > 0) {
        const rK = d[d.length - 1];
        const ringPts = ballPoly(starPt, rK, metric, 181);
        if (ringPts.length > 0) {
          ctx.beginPath();
          const [rx0, ry0] = worldToCanvas(ringPts[0], width, height);
          ctx.moveTo(rx0, ry0);
          for (let i = 1; i < ringPts.length; i++) {
            const [rx, ry] = worldToCanvas(ringPts[i], width, height);
            ctx.lineTo(rx, ry);
          }
          ctx.closePath();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([5, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // 5. Draw training points
    const hasMine = Xtr.length > nBase;
    for (let i = 0; i < Xtr.length; i++) {
      const pt = Xtr[i];
      const cls = ytr[i];
      const isMine = i >= nBase;
      const [cx, cy] = worldToCanvas(pt, width, height);

      if (isMine) {
        // User placed point: Diamond
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = COLORS[cls] || '#fff';
        ctx.fillRect(-5.5, -5.5, 11, 11);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.0;
        ctx.strokeRect(-5.5, -5.5, 11, 11);
        ctx.restore();
      } else {
        // Base training point: Circle
        ctx.beginPath();
        ctx.arc(cx, cy, 4.5, 0, 2 * Math.PI);
        ctx.fillStyle = COLORS[cls] || '#fff';
        ctx.fill();
        ctx.strokeStyle = '#020617';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    // 6. Draw rank numbers next to nearest neighbors
    if (focus && cachedQuery && (revealed || mode === 'sandbox' || mode === 'wedge')) {
      const { idx } = cachedQuery;
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';

      for (let r = 0; r < idx.length; r++) {
        const trainIdx = idx[r];
        const trainPt = Xtr[trainIdx];
        const [tx, ty] = worldToCanvas(trainPt, width, height);

        const rankText = `${r + 1}`;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.beginPath();
        safeRoundRect(ctx, tx + 4, ty - 15, 15, 14, 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.fillText(rankText, tx + 7, ty - 4);
      }
    }

    // 7. Draw focus / mystery star
    if (focus) {
      const starPt = focus.point;
      const [starCx, starCy] = worldToCanvas(starPt, width, height);

      const isStarRevealed = revealed || mode === 'sandbox' || mode === 'wedge';
      let starFill = '#ffffff';

      if (isStarRevealed && focus.truth !== null && focus.truth !== undefined) {
        starFill = COLORS[focus.truth];
      }

      // Outer glow for the star
      ctx.shadowColor = starFill === '#ffffff' ? '#94a3b8' : starFill;
      ctx.shadowBlur = 10;

      drawStar(ctx, starCx, starCy, 5, 15, 7);
      ctx.fillStyle = starFill;
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      ctx.shadowBlur = 0;

      // Draw "?" when unrevealed in Play mode
      if (!isStarRevealed) {
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', starCx, starCy);
      }
    }

    // Crisp arena frame
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(offsetX, offsetY, plotW, plotH);

    // 8. Matplotlib Title & Legend
    if (title) {
      ctx.font = '600 11px "JetBrains Mono", Consolas, monospace';
      const textMetrics = ctx.measureText(title);
      const titleW = textMetrics.width;
      const badgeX = Math.round(width / 2 - titleW / 2 - 8);
      const badgeY = Math.max(4, offsetY - 23);

      ctx.fillStyle = 'rgba(10, 14, 23, 0.92)';
      ctx.beginPath();
      safeRoundRect(ctx, badgeX, badgeY, titleW + 16, 18, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.7)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#e2e8f0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(title, width / 2, badgeY + 9);
    }

    // Legend badge in top-right of arena
    const legendItems: { label: string; color: string; type: 'rect' | 'diamond' | 'dash' }[] = [];
    for (let c = 0; c < C; c++) {
      legendItems.push({ label: NAMES[c], color: COLORS[c], type: 'rect' });
    }
    if (hasMine) {
      legendItems.push({ label: 'your points', color: '#ffffff', type: 'diamond' });
    }
    if (revealed || mode === 'sandbox' || mode === 'wedge') {
      legendItems.push({ label: 'k-th radius', color: '#cbd5e1', type: 'dash' });
    }
    if (mode === 'wedge') {
      legendItems.push({ label: 'no-go zone', color: '#64748b', type: 'rect' });
    }

    const legendWidth = 106;
    const itemHeight = 15;
    const legendHeight = 6 + legendItems.length * itemHeight;
    const legX = Math.min(width - legendWidth - 8, offsetX + plotW - legendWidth - 6);
    const legY = Math.max(6, offsetY + 6);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    safeRoundRect(ctx, legX, legY, legendWidth, legendHeight, 4);
    ctx.fill();
    ctx.stroke();

    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    for (let li = 0; li < legendItems.length; li++) {
      const item = legendItems[li];
      const iy = legY + 8 + li * itemHeight;

      if (item.type === 'rect') {
        ctx.fillStyle = item.color;
        ctx.fillRect(legX + 6, iy - 4, 8, 8);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.strokeRect(legX + 6, iy - 4, 8, 8);
      } else if (item.type === 'diamond') {
        ctx.save();
        ctx.translate(legX + 10, iy);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = item.color;
        ctx.fillRect(-3, -3, 6, 6);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.0;
        ctx.strokeRect(-3, -3, 6, 6);
        ctx.restore();
      } else if (item.type === 'dash') {
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.moveTo(legX + 6, iy);
        ctx.lineTo(legX + 15, iy);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(item.label, legX + 20, iy);
    }

    ctx.restore();
  }, [
    dimensions,
    Xtr,
    ytr,
    nBase,
    C,
    focus,
    revealed,
    k,
    metric,
    scheme,
    boundary,
    bounds,
    cachedQuery,
    rMin,
    ghosts,
    title,
    bgCanvas,
    worldToCanvas,
    getTransform,
    mode,
  ]);

  // Handle click on canvas
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const worldPt = canvasToWorld(cx, cy, rect.width, rect.height);
    onCanvasClick(worldPt, e.button);
  };

  // Prevent context menu on right click
  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (mode === 'wedge') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const worldPt = canvasToWorld(cx, cy, rect.width, rect.height);
      onCanvasClick(worldPt, 2);
    }
  };

  // Handle mouse motion for live hover bar
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const worldPt = canvasToWorld(cx, cy, rect.width, rect.height);
    onHoverMove(worldPt);
  };

  const handleMouseLeave = () => {
    onHoverMove(null);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full flex-1 min-h-[300px] sm:min-h-[360px] bg-[#0e1420] rounded-lg overflow-hidden border border-slate-800/80 shadow-inner flex items-center justify-center select-none"
    >
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="w-full h-full cursor-crosshair block"
      />
    </div>
  );
};
