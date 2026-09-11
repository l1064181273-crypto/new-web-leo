import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface PlanetIconProps {
  icon: LucideIcon;
  color?: string;
  size?: number;
  type: "daily" | "music" | "study" | "film" | "photo" | "food" | "game";
}

const planetStyles = {
  daily: {
    bg: "from-orange-400 to-amber-600",
    shadow: "shadow-[0_0_30px_rgba(245,158,11,0.5)]",
    ring: "border-orange-200/30",
    rotate: 0,
  },
  music: {
    bg: "from-violet-400 to-purple-600",
    shadow: "shadow-[0_0_30px_rgba(139,92,246,0.5)]",
    ring: "border-violet-200/30",
    rotate: 45,
  },
  study: {
    bg: "from-blue-400 to-indigo-600",
    shadow: "shadow-[0_0_30px_rgba(99,102,241,0.5)]",
    ring: "border-blue-200/30",
    rotate: -15,
  },
  film: {
    bg: "from-slate-400 to-zinc-600",
    shadow: "shadow-[0_0_30px_rgba(148,163,184,0.5)]",
    ring: "border-slate-200/30",
    rotate: 30,
  },
  photo: {
    bg: "from-cyan-400 to-teal-600",
    shadow: "shadow-[0_0_30px_rgba(45,212,191,0.5)]",
    ring: "border-cyan-200/30",
    rotate: -30,
  },
  food: {
    bg: "from-rose-400 to-red-600",
    shadow: "shadow-[0_0_30px_rgba(244,63,94,0.5)]",
    ring: "border-rose-200/30",
    rotate: 15,
  },
  game: {
    bg: "from-emerald-400 to-green-600",
    shadow: "shadow-[0_0_30px_rgba(16,185,129,0.5)]",
    ring: "border-emerald-200/30",
    rotate: -45,
  },
};

const PlanetIcon = ({ icon: Icon, type, size = 64 }: PlanetIconProps) => {
  const style = planetStyles[type];

  return (
    <div className="relative group cursor-pointer" style={{ width: size, height: size }}>
      {/* Orbit Ring */}
      <motion.div
        className={`absolute inset-[-20%] rounded-full border-2 ${style.ring}`}
        style={{ transform: `rotateX(70deg) rotateY(${style.rotate}deg)` }}
        animate={{ 
          rotateZ: [0, 360],
          scale: [1, 1.1, 1],
        }}
        transition={{ 
          rotateZ: { duration: 20, repeat: Infinity, ease: "linear" },
          scale: { duration: 4, repeat: Infinity, ease: "easeInOut" }
        }}
      />
      
      {/* Planet Body */}
      <motion.div
        className={`absolute inset-0 rounded-full bg-gradient-to-br ${style.bg} ${style.shadow} flex items-center justify-center overflow-hidden`}
        whileHover={{ scale: 1.1, rotate: 10 }}
        transition={{ type: "spring", stiffness: 300, damping: 15 }}
      >
        {/* Surface Texture (simulated) */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 mix-blend-overlay" />
        
        {/* Shine */}
        <div className="absolute top-2 left-2 w-1/3 h-1/3 rounded-full bg-white/40 blur-sm" />
        
        {/* Icon */}
        <Icon className="relative z-10 w-1/2 h-1/2 text-white drop-shadow-md" />
      </motion.div>

      {/* Satellite (optional, just a small dot) */}
      <motion.div
        className={`absolute top-0 left-1/2 w-2 h-2 rounded-full bg-white ${style.shadow}`}
        style={{ originY: size * 0.8 }} // Rotate around planet center
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
};

export default PlanetIcon;
