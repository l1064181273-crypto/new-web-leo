import { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";

// ── 程序化星球纹理（丰富版）────────────────────────────────────────────────────
function usePlanetTexture() {
  return useMemo(() => {
    const size = 1024;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    // 1. 底色：深邃宇宙蓝紫 → 墨绿过渡
    const bg = ctx.createLinearGradient(0, 0, size, size);
    bg.addColorStop(0,   "#050a1a");
    bg.addColorStop(0.2, "#0f172a");
    bg.addColorStop(0.5, "#1e1b4b");
    bg.addColorStop(0.75,"#0d2a1a");
    bg.addColorStop(1,   "#0f0a2a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    // 2. 海洋层（深蓝色调，大面积）
    const oceanRegions = [
      { x: 200, y: 200, rx: 300, ry: 180, a: 0.35, c1: "#1e40af", c2: "#1d4ed8" },
      { x: 700, y: 400, rx: 260, ry: 200, a: 0.30, c1: "#1e3a5f", c2: "#2563eb" },
      { x: 400, y: 700, rx: 320, ry: 160, a: 0.28, c1: "#164e63", c2: "#0891b2" },
    ];
    oceanRegions.forEach(({ x, y, rx, ry, a, c1, c2 }) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(rx / 200, ry / 200);
      const g = ctx.createRadialGradient(-30, -30, 10, 0, 0, 200);
      g.addColorStop(0, c2 + "cc");
      g.addColorStop(0.6, c1 + Math.round(a * 255).toString(16).padStart(2, "0"));
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 200, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 3. 大陆块（多色：紫/青/橙/绿）
    const continents = [
      { x: 180, y: 150, r: 110, c1: "#7c3aed", c2: "#4f46e5", a: 0.55 },
      { x: 550, y: 200, r: 90,  c1: "#0e7490", c2: "#06b6d4", a: 0.50 },
      { x: 750, y: 550, r: 100, c1: "#b45309", c2: "#f59e0b", a: 0.45 },
      { x: 300, y: 600, r: 80,  c1: "#065f46", c2: "#10b981", a: 0.50 },
      { x: 850, y: 250, r: 70,  c1: "#9d174d", c2: "#ec4899", a: 0.42 },
      { x: 120, y: 750, r: 65,  c1: "#1e40af", c2: "#60a5fa", a: 0.45 },
      { x: 650, y: 820, r: 75,  c1: "#4c1d95", c2: "#a78bfa", a: 0.48 },
    ];
    continents.forEach(({ x, y, r, c1, c2, a }) => {
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      g.addColorStop(0, c2 + "ff");
      g.addColorStop(0.5, c1 + Math.round(a * 255).toString(16).padStart(2, "0"));
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });

    // 4. 极光带（顶部和底部，彩色水平条纹）
    const auroraTop = ctx.createLinearGradient(0, 0, size, 0);
    auroraTop.addColorStop(0,    "rgba(16,185,129,0)");
    auroraTop.addColorStop(0.15, "rgba(16,185,129,0.18)");
    auroraTop.addColorStop(0.30, "rgba(6,182,212,0.22)");
    auroraTop.addColorStop(0.45, "rgba(139,92,246,0.20)");
    auroraTop.addColorStop(0.60, "rgba(236,72,153,0.18)");
    auroraTop.addColorStop(0.75, "rgba(245,158,11,0.15)");
    auroraTop.addColorStop(0.90, "rgba(16,185,129,0.18)");
    auroraTop.addColorStop(1,    "rgba(16,185,129,0)");
    ctx.fillStyle = auroraTop;
    ctx.fillRect(0, 0, size, 90);
    ctx.fillRect(0, size - 90, size, 90);

    // 5. 洋流线（细白色曲线）
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      const sy = 80 + i * 110;
      ctx.moveTo(0, sy);
      for (let x = 0; x <= size; x += 40) {
        const y = sy + Math.sin((x / size) * Math.PI * 3 + i) * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // 6. 陨石坑（深色圆环）
    const craters = [
      { x: 420, y: 320, r: 28 },
      { x: 680, y: 180, r: 18 },
      { x: 200, y: 480, r: 22 },
      { x: 820, y: 680, r: 15 },
      { x: 350, y: 800, r: 20 },
    ];
    craters.forEach(({ x, y, r }) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 3;
      ctx.stroke();
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(0,0,0,0.25)");
      g.addColorStop(0.6, "rgba(0,0,0,0.08)");
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.fill();
    });

    // 7. 云雾层（白色半透明）
    const clouds = [
      { x: 300, y: 100, rx: 200, ry: 35 },
      { x: 700, y: 300, rx: 180, ry: 28 },
      { x: 150, y: 550, rx: 160, ry: 25 },
      { x: 850, y: 450, rx: 150, ry: 30 },
      { x: 500, y: 700, rx: 220, ry: 32 },
      { x: 400, y: 900, rx: 190, ry: 28 },
    ];
    clouds.forEach(({ x, y, rx, ry }) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(rx / 100, ry / 100);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 100);
      g.addColorStop(0, "rgba(255,255,255,0.18)");
      g.addColorStop(0.5, "rgba(255,255,255,0.08)");
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 100, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 8. 发光城市点（小亮点，模拟文明）
    const cities = [
      { x: 185, y: 155, c: "#fbbf24" },
      { x: 555, y: 205, c: "#34d399" },
      { x: 755, y: 555, c: "#f87171" },
      { x: 305, y: 605, c: "#60a5fa" },
      { x: 855, y: 255, c: "#f472b6" },
    ];
    cities.forEach(({ x, y, c }) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, 12);
      g.addColorStop(0, c + "ff");
      g.addColorStop(0.4, c + "88");
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();
    });

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }, []);
}

// ── 大气层（带极光色彩）────────────────────────────────────────────────────────
function Atmosphere() {
  const meshRef = useRef<THREE.Mesh>(null);

  // 外层大气（蓝色边缘光）
  const outerMat = useMemo(() => new THREE.MeshPhongMaterial({
    color: new THREE.Color("#38bdf8"),
    transparent: true,
    opacity: 0.08,
    side: THREE.FrontSide,
    depthWrite: false,
  }), []);

  // 极光层（绿色）
  const auroraMat = useMemo(() => new THREE.MeshPhongMaterial({
    color: new THREE.Color("#10b981"),
    transparent: true,
    opacity: 0.05,
    side: THREE.FrontSide,
    depthWrite: false,
  }), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    outerMat.opacity = 0.07 + Math.sin(t * 0.7) * 0.025;
    auroraMat.opacity = 0.04 + Math.sin(t * 1.1 + 1.5) * 0.02;
  });

  return (
    <group>
      <mesh>
        <sphereGeometry args={[1.06, 64, 64]} />
        <primitive object={outerMat} attach="material" />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.10, 64, 64]} />
        <primitive object={auroraMat} attach="material" />
      </mesh>
    </group>
  );
}

// ── 土星环 ────────────────────────────────────────────────────────────────────
function PlanetRing() {
  const ringTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 32;
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 512, 0);
    g.addColorStop(0,    "rgba(139,92,246,0)");
    g.addColorStop(0.1,  "rgba(139,92,246,0.35)");
    g.addColorStop(0.25, "rgba(99,102,241,0.55)");
    g.addColorStop(0.4,  "rgba(167,139,250,0.40)");
    g.addColorStop(0.55, "rgba(139,92,246,0.60)");
    g.addColorStop(0.7,  "rgba(79,70,229,0.45)");
    g.addColorStop(0.85, "rgba(139,92,246,0.30)");
    g.addColorStop(1,    "rgba(139,92,246,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 32);
    return new THREE.CanvasTexture(c);
  }, []);

  return (
    <mesh rotation={[Math.PI * 0.42, 0.2, 0.1]}>
      <ringGeometry args={[1.35, 2.0, 128]} />
      <meshBasicMaterial
        map={ringTex}
        transparent
        opacity={0.55}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

// ── 文字标签 ──────────────────────────────────────────────────────────────────
function LabelSprite() {
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 64;
    const ctx = c.getContext("2d")!;
    ctx.font = "bold 28px 'IBM Plex Sans', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.shadowColor = "#a5b4fc";
    ctx.shadowBlur = 16;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("我的星球", 128, 32);
    return new THREE.CanvasTexture(c);
  }, []);

  return (
    <sprite position={[0, 0, 0]} scale={[1.6, 0.4, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}

// ── 主星球 ────────────────────────────────────────────────────────────────────
function Planet({ texture }: { texture: THREE.Texture }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.10;
    }
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 128, 128]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.65}
          metalness={0.08}
          emissive={new THREE.Color("#0f172a")}
          emissiveIntensity={0.12}
        />
      </mesh>
      <Atmosphere />
      <PlanetRing />
      <LabelSprite />
    </group>
  );
}

// ── 轨道环 ────────────────────────────────────────────────────────────────────
function OrbitRing({ radius, tilt = 0, color = "#ffffff", opacity = 0.08 }: {
  radius: number; tilt?: number; color?: string; opacity?: number;
}) {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    return pts;
  }, [radius]);

  const geo = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

  return (
    <lineLoop rotation={[tilt, 0, 0]}>
      <primitive object={geo} attach="geometry" />
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </lineLoop>
  );
}

// ── 卫星 ──────────────────────────────────────────────────────────────────────
interface SatConfig {
  orbit: number; size: number; color: string;
  speed: number; startAngle: number; tilt: number; emissive?: string;
}

const SATELLITES: SatConfig[] = [
  { orbit: 2.6, size: 0.10, color: "#22d3ee", emissive: "#0e7490", speed: 0.75, startAngle: 0,   tilt: 0.25 },
  { orbit: 3.2, size: 0.09, color: "#f43f5e", emissive: "#9f1239", speed: 0.48, startAngle: 2.1, tilt: -0.35 },
  { orbit: 3.2, size: 0.08, color: "#a855f7", emissive: "#6b21a8", speed: 0.62, startAngle: 4.2, tilt: -0.35 },
  { orbit: 2.6, size: 0.09, color: "#f97316", emissive: "#c2410c", speed: 0.90, startAngle: 3.5, tilt: 0.25 },
  { orbit: 3.8, size: 0.07, color: "#10b981", emissive: "#065f46", speed: 0.35, startAngle: 1.0, tilt: 0.55 },
];

function Satellite({ cfg }: { cfg: SatConfig }) {
  const groupRef = useRef<THREE.Group>(null);
  const angleRef = useRef(cfg.startAngle);

  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(cfg.color),
    emissive: new THREE.Color(cfg.emissive ?? cfg.color),
    emissiveIntensity: 1.0,
    roughness: 0.3,
    metalness: 0.6,
  }), [cfg.color, cfg.emissive]);

  useFrame((_, delta) => {
    angleRef.current += delta * cfg.speed;
    if (groupRef.current) {
      groupRef.current.position.x = Math.cos(angleRef.current) * cfg.orbit;
      groupRef.current.position.z = Math.sin(angleRef.current) * cfg.orbit;
      groupRef.current.position.y = Math.sin(angleRef.current + cfg.tilt) * 0.22;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[cfg.size, 16, 16]} />
        <primitive object={mat} attach="material" />
      </mesh>
      <pointLight color={cfg.color} intensity={0.5} distance={1.0} />
    </group>
  );
}

// ── 流星 ──────────────────────────────────────────────────────────────────────
function Meteors() {
  const meteors = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 12,
      y: (Math.random() - 0.5) * 8 + 3,
      z: (Math.random() - 0.5) * 6,
      speed: 0.8 + Math.random() * 1.2,
      length: 0.3 + Math.random() * 0.5,
    })), []);

  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const timers = useRef(meteors.map(() => Math.random() * 5));

  useFrame((_, delta) => {
    meteors.forEach((m, i) => {
      timers.current[i] -= delta;
      const mesh = refs.current[i];
      if (!mesh) return;
      if (timers.current[i] <= 0) {
        mesh.position.set(m.x, m.y, m.z);
        timers.current[i] = 3 + Math.random() * 6;
        (mesh.material as THREE.MeshBasicMaterial).opacity = 0.9;
      }
      mesh.position.x -= delta * m.speed * 2;
      mesh.position.y -= delta * m.speed * 0.8;
      (mesh.material as THREE.MeshBasicMaterial).opacity *= 0.97;
    });
  });

  return (
    <>
      {meteors.map((m, i) => (
        <mesh
          key={m.id}
          ref={el => { refs.current[i] = el; }}
          position={[m.x, m.y, m.z]}
          rotation={[0, 0, -Math.PI / 6]}
        >
          <boxGeometry args={[m.length, 0.012, 0.012]} />
          <meshBasicMaterial color="#e0e7ff" transparent opacity={0.8} />
        </mesh>
      ))}
    </>
  );
}

// ── 鼠标跟随相机 ──────────────────────────────────────────────────────────────
function CameraRig() {
  const { camera, gl } = useThree();
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });

  useFrame(() => {
    const canvas = gl.domElement;
    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      target.current.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      target.current.y = -((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    canvas.addEventListener("mousemove", onMove, { once: true });
    current.current.x += (target.current.x - current.current.x) * 0.04;
    current.current.y += (target.current.y - current.current.y) * 0.04;
    camera.position.x = current.current.x * 1.5;
    camera.position.y = current.current.y * 1.0;
    camera.lookAt(0, 0, 0);
  });

  return null;
}

// ── 场景 ──────────────────────────────────────────────────────────────────────
function Scene() {
  const texture = usePlanetTexture();

  return (
    <>
      {/* 灯光 */}
      <ambientLight intensity={0.20} />
      {/* 主光（左上，冷白） */}
      <directionalLight position={[-5, 4, 2]} intensity={2.5} color="#e0e7ff" />
      {/* 橙色补光（右下，暖色边缘） */}
      <pointLight position={[5, -3, -2]} intensity={0.9} color="#f97316" />
      {/* 青色补光（后方） */}
      <pointLight position={[0, 2, -5]} intensity={0.6} color="#22d3ee" />

      {/* 背景星空 */}
      <Stars radius={35} depth={25} count={4000} factor={2.2} fade speed={0.4} />

      {/* 流星 */}
      <Meteors />

      {/* 主星球 */}
      <Planet texture={texture} />

      {/* 轨道环（带颜色） */}
      <OrbitRing radius={2.6}  tilt={0.25}  color="#22d3ee" opacity={0.12} />
      <OrbitRing radius={3.2}  tilt={-0.35} color="#a855f7" opacity={0.10} />
      <OrbitRing radius={3.8}  tilt={0.55}  color="#10b981" opacity={0.09} />

      {/* 卫星 */}
      {SATELLITES.map((cfg, i) => <Satellite key={i} cfg={cfg} />)}

      {/* 相机跟随 */}
      <CameraRig />
    </>
  );
}

// ── 导出 ──────────────────────────────────────────────────────────────────────
const TitlePlanet = () => (
  <div className="w-[min(90vw,520px)] h-[min(90vw,520px)] mx-auto">
    <Canvas
      camera={{ position: [0, 0, 6], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      <Scene />
    </Canvas>
  </div>
);

export default TitlePlanet;
