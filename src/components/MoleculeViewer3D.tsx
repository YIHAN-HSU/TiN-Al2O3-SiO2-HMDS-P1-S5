/**
 * 3D Energy Minimized Conformer Interactive Viewer
 * Features dynamic responsive viewport, auto fit-to-view, orbit drag,
 * wheel zoom, reset orientation, and oxidized/hydroxylated TiN surface slab.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { RotateCcw, Layers, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Conformer3DData } from '../chemistry/backendEngine';

interface MoleculeViewer3DProps {
  conformer?: Conformer3DData;
  formula?: string;
  smiles?: string;
}

const ELEMENT_COLORS: Record<string, { fill: string; stroke: string; text: string; radius: number }> = {
  C: { fill: '#334155', stroke: '#0F172A', text: '#FFFFFF', radius: 13 },
  O: { fill: '#E11D48', stroke: '#9F1239', text: '#FFFFFF', radius: 14.5 },
  N: { fill: '#2563EB', stroke: '#1E40AF', text: '#FFFFFF', radius: 14 },
  S: { fill: '#D97706', stroke: '#92400E', text: '#FFFFFF', radius: 16 },
  F: { fill: '#059669', stroke: '#065F46', text: '#FFFFFF', radius: 12 },
  Cl: { fill: '#10B981', stroke: '#047857', text: '#FFFFFF', radius: 15 },
  Br: { fill: '#9333EA', stroke: '#6B21A8', text: '#FFFFFF', radius: 16.5 },
  P: { fill: '#EA580C', stroke: '#9A3412', text: '#FFFFFF', radius: 15 },
  H: { fill: '#E2E8F0', stroke: '#94A3B8', text: '#0F172A', radius: 9 },
};

export const MoleculeViewer3D: React.FC<MoleculeViewer3DProps> = ({
  conformer,
  formula,
  smiles,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 800,
    height: 560,
  });

  const [rotX, setRotX] = useState<number>(24);
  const [rotY, setRotY] = useState<number>(-26);
  const [zoom, setZoom] = useState<number>(1.0);
  const [showSurface, setShowSurface] = useState<boolean>(true);
  const [hoveredAtomIdx, setHoveredAtomIdx] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragOrigin, setDragOrigin] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Reset orientation and auto-center on molecule switch (Section 03)
  useEffect(() => {
    if (conformer?.conformer_id) {
      setRotX(24);
      setRotY(-26);
      setZoom(1.0);
      setHoveredAtomIdx(null);
    }
  }, [conformer?.conformer_id]);

  // Responsive ResizeObserver for viewport dimensions (Section 03)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          setDimensions({ width: Math.round(w), height: Math.round(h) });
        }
      }
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, []);

  // Smooth wheel zoom with passive: false to prevent background scroll (Section 04)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.08 : -0.08;
      setZoom((prev) => Math.min(2.5, Math.max(0.4, Number((prev + delta).toFixed(2)))));
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', onWheel);
    };
  }, []);

  // Calculate molecular bounds and auto-fit scaling (Section 03)
  const bounds = useMemo(() => {
    if (!conformer || conformer.atoms.length === 0) {
      return { meanX: 0, meanY: 0, meanZ: 0, maxSpan: 1 };
    }
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let sumX = 0, sumY = 0, sumZ = 0;

    for (const a of conformer.atoms) {
      minX = Math.min(minX, a.x); maxX = Math.max(maxX, a.x);
      minY = Math.min(minY, a.y); maxY = Math.max(maxY, a.y);
      minZ = Math.min(minZ, a.z); maxZ = Math.max(maxZ, a.z);
      sumX += a.x; sumY += a.y; sumZ += a.z;
    }

    const n = conformer.atoms.length;
    const meanX = sumX / n;
    const meanY = sumY / n;
    const meanZ = sumZ / n;

    const spanX = maxX - minX;
    const spanY = maxY - minY;
    const spanZ = maxZ - minZ;
    const maxSpan = Math.max(spanX, spanY, spanZ, 2.5);

    return { meanX, meanY, meanZ, maxSpan };
  }, [conformer]);

  // Project 3D coordinates into dynamic 2D viewport
  const projected = useMemo(() => {
    if (!conformer || conformer.atoms.length === 0) return { atoms: [], bonds: [], rawIndexed: [] };

    const { width, height } = dimensions;
    const radX = (rotX * Math.PI) / 180;
    const radY = (rotY * Math.PI) / 180;
    const cosX = Math.cos(radX);
    const sinX = Math.sin(radX);
    const cosY = Math.cos(radY);
    const sinY = Math.sin(radY);

    const { meanX, meanY, meanZ, maxSpan } = bounds;

    // Automatic fit-to-view scale calculation
    const availableH = showSurface ? height * 0.58 : height * 0.75;
    const availableW = width * 0.72;
    const targetDimension = Math.min(availableW, availableH);
    const baseScale = targetDimension / maxSpan;
    const scale = baseScale * zoom;

    const centerX = width / 2;
    const centerY = showSurface ? height * 0.42 : height / 2;

    const projAtoms = conformer.atoms.map((a) => {
      const x0 = a.x - meanX;
      const y0 = a.y - meanY;
      const z0 = a.z - meanZ;

      const x1 = x0 * cosY + z0 * sinY;
      const z1 = -x0 * sinY + z0 * cosY;
      const y2 = y0 * cosX - z1 * sinX;
      const z2 = y0 * sinX + z1 * cosX;

      const perspective = 1 + z2 * 0.04;
      return {
        ...a,
        sx: centerX + x1 * scale * perspective,
        sy: centerY + y2 * scale * perspective,
        sz: z2,
      };
    });

    const projBonds = conformer.bonds.map((b) => {
      const u = projAtoms[b.begin_atom] || { sx: centerX, sy: centerY, sz: 0 };
      const v = projAtoms[b.end_atom] || { sx: centerX, sy: centerY, sz: 0 };
      return {
        ...b,
        u,
        v,
        avgZ: (u.sz + v.sz) / 2,
      };
    });

    return {
      atoms: [...projAtoms].sort((a, b) => a.sz - b.sz),
      bonds: [...projBonds].sort((a, b) => a.avgZ - b.avgZ),
      rawIndexed: projAtoms,
    };
  }, [conformer, dimensions, rotX, rotY, zoom, showSurface, bounds]);

  // Mouse drag orbit handling
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    setIsDragging(true);
    setDragOrigin({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragOrigin.x;
    const dy = e.clientY - dragOrigin.y;
    setRotY((prev) => prev + dx * 0.5);
    setRotX((prev) => Math.max(-80, Math.min(80, prev + dy * 0.5)));
    setDragOrigin({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => setIsDragging(false);

  const resetView = () => {
    setRotX(24);
    setRotY(-26);
    setZoom(1.0);
  };

  const hoveredAtom =
    hoveredAtomIdx !== null && projected.rawIndexed
      ? projected.rawIndexed[hoveredAtomIdx]
      : null;

  const { width, height } = dimensions;
  const slabY = height - 58;

  return (
    <div className="bg-white border border-slate-200 overflow-hidden shadow-2xs">
      {/* Header Toolbar */}
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs">
          <span className="font-bold text-slate-900 font-sans tracking-tight">
            {formula || 'Conformer Viewer'}
          </span>
          <span className="text-slate-300">·</span>
          <span className="font-mono text-slate-500 truncate max-w-xs md:max-w-md">
            {smiles}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowSurface((s) => !s)}
            className={`px-3 py-1.5 text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
              showSurface
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
            title="切換原始 TiN 表面示意（非實際表面計算）"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>TiN 表面示意</span>
          </button>

          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.15).toFixed(2))))}
            className="p-1.5 text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
            title="放大（向上捲動）"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))))}
            className="p-1.5 text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
            title="縮小（向下捲動）"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={resetView}
            className="p-1.5 text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
            title="重設 3D 視角與置中"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Responsive Viewport (Desktop 520–620px, Tablet 440–500px, Mobile 340–400px) */}
      <div
        ref={containerRef}
        className="w-full h-[360px] md:h-[480px] lg:h-[560px] relative bg-slate-950 select-none overflow-hidden"
      >
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full cursor-grab active:cursor-grabbing block"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <defs>
            <pattern id="grid3d_wide" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(148, 163, 184, 0.06)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={width} height={height} fill="url(#grid3d_wide)" />

          {/* Oxidized/Hydroxylated TiN 表面示意 Representation (TIN_OXOH_V01) */}
          {showSurface && (
            <g>
              {/* Interaction vectors from polar groups down to surface */}
              {projected.atoms
                .filter((a) => a.symbol === 'O' || a.symbol === 'N' || (a.atomic_num === 6 && a.idx % 2 === 0))
                .map((a) => (
                  <line
                    key={`vec-${a.idx}`}
                    x1={a.sx}
                    y1={a.sy + 12}
                    x2={a.sx}
                    y2={slabY - 4}
                    stroke="#06B6D4"
                    strokeWidth="1.2"
                    strokeDasharray="4 4"
                    opacity="0.55"
                  />
                ))}

              {/* Surface base slab rectangle */}
              <rect
                x="32"
                y={slabY}
                width={Math.max(100, width - 64)}
                height="44"
                fill="#0F172A"
                stroke="#0891B2"
                strokeWidth="1.2"
                opacity="0.95"
              />

              {/* Surface Ti, O, and OH lattice atoms */}
              {Array.from({ length: Math.max(4, Math.floor((width - 80) / 46)) }).map((_, idx) => {
                const sx = 52 + idx * 46;
                const isOH = idx % 2 === 0;
                return (
                  <g key={`tin-site-${idx}`}>
                    <circle cx={sx} cy={slabY + 24} r={7} fill="#0891B2" stroke="#22D3EE" strokeWidth="1" />
                    <text x={sx} y={slabY + 26.5} textAnchor="middle" fontSize="7" fill="#ECFEFF" fontFamily="IBM Plex Mono">
                      Ti
                    </text>
                    {idx % 2 === 1 && (
                      <circle cx={sx + 23} cy={slabY + 30} r={5} fill="#1E40AF" stroke="#60A5FA" strokeWidth="0.8" />
                    )}
                    <line x1={sx} y1={slabY + 17} x2={sx} y2={slabY - 3} stroke="#94A3B8" strokeWidth="1.2" />
                    <circle cx={sx} cy={slabY - 7} r={isOH ? 6 : 5} fill={isOH ? '#E11D48' : '#F59E0B'} />
                    <text x={sx} y={slabY - 17} textAnchor="middle" fontSize="7.5" fill={isOH ? '#FDA4AF' : '#FDE68A'} fontFamily="IBM Plex Mono">
                      {isOH ? 'OH' : 'O*'}
                    </text>
                  </g>
                );
              })}

              <text x={width / 2} y={height - 8} textAnchor="middle" fontSize="9" fill="#22D3EE" fontFamily="IBM Plex Mono">
                表面識別碼：TIN_OXOH_V01；原始模型的氧化／羥基化 TiN 晶格示意
              </text>
            </g>
          )}

          {/* Render 3D Bonds */}
          {projected.bonds.map((b) => {
            const dx = b.v.sx - b.u.sx;
            const dy = b.v.sy - b.u.sy;
            const len = Math.hypot(dx, dy) || 1;
            const nx = (-dy / len) * 3.2;
            const ny = (dx / len) * 3.2;

            if (b.order === 2) {
              return (
                <g key={`b-${b.idx}`}>
                  <line x1={b.u.sx + nx} y1={b.u.sy + ny} x2={b.v.sx + nx} y2={b.v.sy + ny} stroke="#94A3B8" strokeWidth="2.4" />
                  <line x1={b.u.sx - nx} y1={b.u.sy - ny} x2={b.v.sx - nx} y2={b.v.sy - ny} stroke="#94A3B8" strokeWidth="2.4" />
                </g>
              );
            }
            if (b.order === 3) {
              return (
                <g key={`b-${b.idx}`}>
                  <line x1={b.u.sx} y1={b.u.sy} x2={b.v.sx} y2={b.v.sy} stroke="#94A3B8" strokeWidth="2" />
                  <line x1={b.u.sx + nx * 1.3} y1={b.u.sy + ny * 1.3} x2={b.v.sx + nx * 1.3} y2={b.v.sy + ny * 1.3} stroke="#94A3B8" strokeWidth="1.8" />
                  <line x1={b.u.sx - nx * 1.3} y1={b.u.sy - ny * 1.3} x2={b.v.sx - nx * 1.3} y2={b.v.sy - ny * 1.3} stroke="#94A3B8" strokeWidth="1.8" />
                </g>
              );
            }
            return (
              <line
                key={`b-${b.idx}`}
                x1={b.u.sx}
                y1={b.u.sy}
                x2={b.v.sx}
                y2={b.v.sy}
                stroke="#94A3B8"
                strokeWidth="2.6"
              />
            );
          })}

          {/* Render 3D Atoms */}
          {projected.atoms.map((a) => {
            const col = ELEMENT_COLORS[a.symbol] || ELEMENT_COLORS.C;
            const isHover = hoveredAtomIdx === a.idx;
            const radius = col.radius || 13;

            return (
              <g
                key={`a-${a.idx}`}
                onMouseEnter={() => setHoveredAtomIdx(a.idx)}
                onMouseLeave={() => setHoveredAtomIdx(null)}
                className="cursor-pointer"
              >
                {isHover && (
                  <circle cx={a.sx} cy={a.sy} r={radius + 5} fill="none" stroke="#22D3EE" strokeWidth="2.5" />
                )}
                <circle cx={a.sx} cy={a.sy} r={radius} fill={col.fill} stroke={col.stroke} strokeWidth="1.8" />
                <text
                  x={a.sx}
                  y={a.sy + 3.8}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="600"
                  fill={col.text}
                  fontFamily="IBM Plex Mono"
                >
                  {a.symbol}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Top-Left Conformer Energy HUD */}
        <div className="absolute top-3 left-3 text-[11px] font-mono text-slate-300 bg-slate-950/85 px-3 py-1.5 border border-slate-800 pointer-events-none shadow-md">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">示意最佳化方法：</span>
            <span className="text-cyan-400 font-semibold">{conformer?.optimization_method || 'ETKDGv3 MMFF94s'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">舊版示意能量（非真實構形能）：</span>
            <span className="text-white font-bold">{conformer?.energy_kcal_mol} kcal/mol</span>
          </div>
        </div>

        {/* Top-Right Atom Inspector HUD */}
        <div className="absolute top-3 right-3 text-[11px] font-mono text-slate-300 bg-slate-950/85 px-3 py-1.5 border border-slate-800 text-right pointer-events-none shadow-md">
          {hoveredAtom ? (
            <div>
              <div className="text-cyan-300 font-semibold">
                原子編號 #{hoveredAtom.idx + 1} [{hoveredAtom.symbol}]
              </div>
              <div className="text-slate-300">
                ({hoveredAtom.x}, {hoveredAtom.y}, {hoveredAtom.z}) Å
              </div>
            </div>
          ) : (
            <div className="text-slate-400">
              拖曳旋轉；捲動縮放；游標指向原子
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
