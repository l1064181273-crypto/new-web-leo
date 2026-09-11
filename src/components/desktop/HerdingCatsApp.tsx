import { useEffect, useRef } from "react";
import "@/styles/herding-cats.css";

const GAME_URL = "https://herding-cats-ten.vercel.app/";

export default function HerdingCatsApp({ active }: { active: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (active) frame.current?.focus({ preventScroll: true });
  }, [active]);
  return (
    <section className="herding-cats" aria-label="Herding Cats 游戏">
      {active ? (
        <iframe
          ref={frame}
          src={GAME_URL}
          title="Herding Cats"
          allow="autoplay; fullscreen"
        />
      ) : (
        <div className="herding-cats-sleep" aria-hidden="true" />
      )}
    </section>
  );
}
