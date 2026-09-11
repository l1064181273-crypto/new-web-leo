import { useEffect, useRef } from "react";

const runSprites = {
  e: ["erun1", "erun2"],
  ne: ["nerun1", "nerun2"],
  n: ["nrun1", "nrun2"],
  nw: ["nwrun1", "nwrun2"],
  w: ["wrun1", "wrun2"],
  sw: ["swrun1", "swrun2"],
  s: ["srun1", "srun2"],
  se: ["serun1", "serun2"],
} as const;

function direction(dx: number, dy: number): keyof typeof runSprites {
  const octant = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return ["e", "se", "s", "sw", "w", "nw", "n", "ne"][
    (octant + 8) % 8
  ] as keyof typeof runSprites;
}

export default function CompanionCat({ awake }: { awake: boolean }) {
  const cat = useRef<HTMLImageElement>(null);
  const awakeRef = useRef(awake);
  useEffect(() => {
    awakeRef.current = awake;
  }, [awake]);
  useEffect(() => {
    const base = `${import.meta.env.BASE_URL}desktop/neko/`;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const position = { x: innerWidth * 0.5 - 16, y: innerHeight * 0.52 - 16 };
    let target = { ...position };
    let idleSince = performance.now();
    let frame = 0;
    let last = 0;
    let current = "";
    const setSprite = (name: string) => {
      if (name !== current && cat.current) {
        cat.current.src = `${base}${name}.gif`;
        current = name;
      }
    };
    const moveTarget = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      target = { x: event.clientX - 16, y: event.clientY - 16 };
    };
    const render = (now: number) => {
      const delta = Math.min(32, now - (last || now));
      last = now;
      if (awakeRef.current && !document.hidden && cat.current) {
        target.x = Math.max(0, Math.min(innerWidth - 32, target.x));
        target.y = Math.max(40, Math.min(innerHeight - 122, target.y));
        const dx = target.x - position.x;
        const dy = target.y - position.y;
        const distance = Math.hypot(dx, dy);
        if (!reduced.matches && distance > 16) {
          const step = Math.min(distance - 12, delta * 0.18);
          position.x += (dx / distance) * step;
          position.y += (dy / distance) * step;
          setSprite(runSprites[direction(dx, dy)][Math.floor(now / 120) % 2]);
          idleSince = now;
          cat.current.dataset.state = "walking";
        } else {
          const idle = now - idleSince;
          const sprite =
            idle < 1800
              ? "still"
              : idle < 3300
                ? `itch${Math.floor(now / 260) % 2 + 1}`
                : idle < 4500
                  ? "lickpaw"
                  : idle < 5400
                    ? "yawn"
                    : `sleep${Math.floor(now / 650) % 2 + 1}`;
          setSprite(sprite);
          cat.current.dataset.state = idle > 5400 ? "sleeping" : "resting";
        }
        cat.current.style.transform = `translate3d(${position.x}px,${position.y}px,0)`;
      }
      frame = requestAnimationFrame(render);
    };
    window.addEventListener("pointermove", moveTarget, { passive: true });
    setSprite("still");
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", moveTarget);
    };
  }, []);
  return (
    <img
      ref={cat}
      className="companion-cat"
      src={`${import.meta.env.BASE_URL}desktop/neko/still.gif`}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
