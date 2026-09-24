import { useEffect, useId, useRef } from "react";
import { CatDefinition, CatState, GardenState, Point, levelFor, samePoint } from "./engine";
import { PixelCat } from "./PixelCat";
export { PixelCat } from "./PixelCat";

const TILE = 48;

function Gardener() {
  return (
    <g shapeRendering="crispEdges">
      <ellipse cx="0" cy="18" rx="13" ry="4" fill="#203e3828" />
      <path d="M-8 6h16v11h-5v5H0v-5h-3v5h-5z" fill="#578cab" />
      <path d="M-10 8h3v8h-3zM7 8h3v8H7z" fill="#e9c79e" />
      <path d="M-8-7H8V6H-8z" fill="#edcba6" />
      <path d="M-10-9H10V-2H-10zM-6-14H6v5H-6zM-14-3H14V0H-14z" fill="#426b88" />
      <path d="M-6 1h2v2h-2zM4 1h2v2H4z" fill="#314a43" />
      <path d="M-4 6h8v3h-8z" fill="#efbd6d" />
      <path d="M-4 11h8v4h-8z" fill="#84abc0" />
    </g>
  );
}

function CatInGarden({ cat, definition, index, stacked }: { cat: CatState; definition: CatDefinition; index: number; stacked: boolean }) {
  const x = cat.x * TILE + 5 + (stacked ? (index % 2 ? 5 : -5) : 0);
  const y = cat.y * TILE + 6 + (stacked ? (index % 2 ? 4 : -4) : 0);
  return (
    <g className={`cat-garden-cat ${cat.status === "following" || cat.status === "homebound" ? "is-following" : ""}`} transform={`translate(${x} ${y})`}>
      <title>{`${definition.name} · ${cat.status === "waiting" ? cat.awake ? "等待呼唤" : "正在打盹" : "跟着回家"}`}</title>
      {cat.status !== "waiting" && <ellipse cx="19" cy="32" rx="17" ry="7" fill="#e7f5dcaa" />}
      <PixelCat coat={definition.coat} size={38} sleeping={!cat.awake} />
      {!cat.awake && <text className="cat-sleep-letter" x="31" y="3" fill="#4c6360" fontSize="12" fontFamily="monospace" fontWeight="700">z</text>}
      {cat.status === "waiting" && cat.awake && definition.personality === "shy" && <g fill="#f7f4df" stroke="#7a9180" strokeWidth="1"><path d="M30-5h12v10H37l-4 4V5h-3z" /><path d="M35-1v2m4-2v2" stroke="#5c7565" /></g>}
    </g>
  );
}

interface GardenBoardProps {
  state: GardenState;
  route: Point[];
  callPulse: number;
  interactive: boolean;
  onTile: (point: Point) => void;
}

export default function GardenBoard({ state, route, callPulse, interactive, onTile }: GardenBoardProps) {
  const level = levelFor(state.levelId);
  const patternId = useId().replace(/:/g, "");
  const pointerStart = useRef<{ id: number; x: number; y: number; time: number } | null>(null);
  useEffect(() => { pointerStart.current = null; }, [interactive, state.levelId]);
  const visibleCats = state.cats.filter((cat) => cat.status !== "home");
  const treeAt = (point: Point) => point.x === 0 || point.y === 0 || point.x === level.width - 1 || point.y === level.height - 1 || level.hedges.some((tile) => samePoint(tile, point));

  return (
    <svg
      className="cat-garden-board"
      viewBox={`0 0 ${level.width * TILE} ${level.height * TILE}`}
      role="img"
      aria-label={`${level.title}。你在第 ${state.player.x} 列、第 ${state.player.y} 行。${state.cats.filter((cat) => cat.status === "home").length} 只猫已经回家。右上角是猫屋。`}
      onPointerDown={(event) => {
        // A second finger cancels the whole gesture; it must not replace the
        // primary finger's pending tap while the browser is starting a pinch.
        pointerStart.current = interactive && event.button === 0 && event.isPrimary !== false ? { id: event.pointerId, x: event.clientX, y: event.clientY, time: Date.now() } : null;
      }}
      onPointerMove={(event) => {
        const start = pointerStart.current;
        // Remember that this was a drag, even if it ends back at its origin.
        if (start && (event.pointerId !== start.id || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12)) pointerStart.current = null;
      }}
      onPointerLeave={() => { pointerStart.current = null; }}
      onPointerCancel={() => { pointerStart.current = null; }}
      onPointerUp={(event) => {
        const start = pointerStart.current;
        pointerStart.current = null;
        if (!interactive || !start || event.pointerId !== start.id || event.button !== 0 || Date.now() - start.time > 600) return;
        if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        if (event.clientX < bounds.left || event.clientX >= bounds.right || event.clientY < bounds.top || event.clientY >= bounds.bottom) return;
        onTile({ x: Math.floor((event.clientX - bounds.left) / bounds.width * level.width), y: Math.floor((event.clientY - bounds.top) / bounds.height * level.height) });
      }}
    >
      <defs>
        <pattern id={patternId} x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M2 3h2M9 9h2" stroke="#4d79550b" strokeWidth="2" /></pattern>
      </defs>
      <rect width={level.width * TILE} height={level.height * TILE} fill="#b7cda1" />
      {Array.from({ length: level.width * level.height }, (_, index) => {
        const x = index % level.width;
        const y = Math.floor(index / level.width);
        const point = { x, y };
        const isTree = treeAt(point);
        const isWater = level.water.some((tile) => samePoint(tile, point));
        const seed = (x * 13 + y * 7) % 17;
        return (
          <g key={index} transform={`translate(${x * TILE} ${y * TILE})`} shapeRendering="crispEdges">
            {!isTree && !isWater && <>
              <rect width={TILE} height={TILE} fill={seed % 3 === 0 ? "#bbcea7" : "#b6cba1"} />
              <path d="M0 47h48M47 0v48" stroke="#8cab7b25" strokeWidth="1" />
              {seed % 4 === 0 && <path d="M9 35h3v-3m16-20h3v3" fill="none" stroke="#8bab7d" strokeWidth="2" />}
              {seed === 5 && !samePoint(point, level.home) && <g fill="#f1ecba"><rect x="5" y="8" width="3" height="3" /><rect x="8" y="5" width="3" height="3" /><rect x="8" y="11" width="3" height="3" /><rect x="11" y="8" width="3" height="3" /></g>}
            </>}
            {isTree && <>
              <rect x="2" y="12" width="44" height="36" fill="#789269" />
              <path d="M4 7h8V3h24v4h8v29h-4v7H8v-7H4z" fill={seed % 2 ? "#77976a" : "#719163"} />
              <path d="M8 9h6V5h19v4h7v7H8z" fill="#88a877" />
              <path d="M11 21h8v3h-8m17 8h8v3h-8m-3-20h5v3h-5" fill="#5c8056" />
              {level.number === 2 && seed % 3 === 0 && <g fill="#9eaeca"><rect x="20" y="16" width="9" height="13" /><rect x="16" y="20" width="17" height="6" /><rect x="22" y="20" width="5" height="5" fill="#bac6dc" /></g>}
            </>}
            {isWater && <>
              <rect width={TILE} height={TILE} fill="#82b5c1" />
              <path d="M0 3h48M2 0v48" stroke="#679fa8" strokeWidth="4" />
              <g className="cat-water-ripple" fill="#b4d6d7"><rect x="10" y="15" width="13" height="2" /><rect x="25" y="31" width="11" height="2" /></g>
              {seed % 2 === 0 && <g fill="#77a17c"><rect x="27" y="5" width="12" height="8" /><rect x="31" y="3" width="5" height="12" /></g>}
            </>}
          </g>
        );
      })}
      <rect width={level.width * TILE} height={level.height * TILE} fill={`url(#${patternId})`} pointerEvents="none" />
      {route.length > 0 && <g className="cat-planned-route" fill="none" stroke="#3a6c60" strokeWidth="3" strokeLinecap="round">
        <polyline points={[state.player, ...route].map((point) => `${point.x * TILE + 24},${point.y * TILE + 24}`).join(" ")} strokeDasharray="3 8" opacity=".65" />
        <circle cx={route[route.length - 1].x * TILE + 24} cy={route[route.length - 1].y * TILE + 24} r="10" fill="#ecf4de80" />
      </g>}
      {level.gate && <g transform={`translate(${level.gate.x * TILE} ${level.gate.y * TILE})`} shapeRendering="crispEdges">
        <rect x="1" y="4" width="7" height="41" fill="#9d7952" /><rect x="40" y="4" width="7" height="41" fill="#9d7952" />
        {!state.keyCollected ? <><path d="M9 9h6v28H9zm12 0h6v28h-6zm12 0h6v28h-6zM8 15h34v5H8zm0 14h34v5H8z" fill="#c6a073" /><rect x="22" y="21" width="5" height="7" fill="#d9b753" /></> : <path d="M4 8h4v31H4zm38 0h3v31h-3z" fill="#d9b581" />}
      </g>}
      {level.key && !state.keyCollected && <g transform={`translate(${level.key.x * TILE + 24} ${level.key.y * TILE + 22})`} className="cat-garden-key">
        <ellipse cx="1" cy="10" rx="13" ry="5" fill="#7b8c5640" />
        <circle r="6" fill="none" stroke="#b58c34" strokeWidth="5" /><path d="M5 1h13v5m-5-5v5" stroke="#b58c34" strokeWidth="4" fill="none" /><circle r="6" fill="none" stroke="#efd074" strokeWidth="3" /><path d="M5 0h13v4m-5-4v4" stroke="#efd074" strokeWidth="2" fill="none" />
      </g>}
      <g transform={`translate(${level.home.x * TILE + 24} ${level.home.y * TILE + 22})`} shapeRendering="crispEdges">
        <ellipse cx="0" cy="22" rx="26" ry="7" fill="#697d5040" />
        <path d="M-20-5h40v27h-40z" fill="#ede3c5" /><path d="M-22-7h44v6h-44z" fill="#915e3f" />
        <path d="M-25-10h5v-5h5v-5H-8v-5H8v5h7v5h5v5h5v5H-25z" fill="#c18555" />
        <path d="M-13-15h26v4h-26zM-20-8h40v3h-40z" fill="#d79a64" />
        <path d="M-6 4h12v18H-6z" fill="#536e57" /><rect x="-16" y="4" width="7" height="7" fill="#8db5b8" /><rect x="9" y="4" width="7" height="7" fill="#8db5b8" />
        <rect x="-11" y="21" width="22" height="5" fill="#bfad84" />
        <text x="0" y="-28" fill="#385c49" textAnchor="middle" fontSize="9" fontWeight="700" fontFamily="monospace">HOME</text>
        {state.cats.some((cat) => cat.status === "home") && <g transform="translate(14 12)"><rect x="0" y="0" width="15" height="14" rx="4" fill="#f7efce" /><text x="7.5" y="10" fill="#4f7157" textAnchor="middle" fontSize="10" fontFamily="monospace" fontWeight="700">{state.cats.filter((cat) => cat.status === "home").length}</text></g>}
      </g>
      {visibleCats.map((cat, index) => <CatInGarden key={cat.id} cat={cat} definition={level.cats.find((item) => item.id === cat.id)!} index={index} stacked={visibleCats.some((other) => other.id !== cat.id && samePoint(other, cat))} />)}
      <g className="cat-gardener" transform={`translate(${state.player.x * TILE + 24} ${state.player.y * TILE + 22})`}>
        <ellipse cx="0" cy="14" rx="20" ry="11" fill="#dceaf075" stroke="#527e92" strokeWidth="1.5" strokeDasharray="3 3" />
        {callPulse > 0 && <g key={callPulse} className="cat-call-wave"><circle r="24" fill="none" stroke="#fbf5d4" strokeWidth="3" /><circle r="38" fill="none" stroke="#fbf5d499" strokeWidth="2" /></g>}
        <Gardener />
      </g>
      <path d={`M1 1h${level.width * TILE - 2}v${level.height * TILE - 2}H1z`} fill="none" stroke="#56785870" strokeWidth="2" pointerEvents="none" />
    </svg>
  );
}
