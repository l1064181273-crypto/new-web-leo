import React, { useEffect, useRef, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Vec2 { x: number; y: number; }

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string; size: number;
  type: 'spark' | 'shockwave' | 'trail' | 'damage';
  text?: string;
  radius?: number;
}

interface Bullet {
  x: number; y: number;
  vx: number; vy: number;
  life: number;
  trail: Vec2[];
  level: number;
  isEnemy?: boolean;
}

interface Obstacle {
  x: number; y: number;
  vx: number; vy: number;
  emoji: string;
  size: number;
  angle: number; spin: number;
  hp: number; maxHp: number;
  hitFlash: number;
  isBoss: boolean;
  tracking: boolean;
  shootTimer: number;
  shootInterval: number;
  // OffscreenCanvas cache key
  cacheKey: string;
}

type PowerupType = 'heal' | 'damage' | 'shield';
interface Powerup {
  x: number; y: number;
  vy: number;
  type: PowerupType;
  emoji: string;
  label: string;
  life: number;
  pulse: number;
}

interface Star {
  x: number; y: number;
  size: number; alpha: number;
  layer: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMOJIS        = ['👾', '☄️', '🌑', '🔥', '⚡️', '🪐', '🛸', '🧱', '💀', '🌀'];
const BOSS_EMOJIS   = ['🐉', '👹', '🤖', '💣', '🌋'];
const WEAPON_COLORS = ['#22d3ee', '#a78bfa', '#f97316', '#ec4899'];
const WEAPON_NAMES  = ['LASER', 'DUAL SHOT', 'TRIPLE SHOT', 'BEAM'];

const WAVE_INTERVAL   = 15000;
const MAX_OBSTACLES   = 18;
const BOSS_WAVE_EVERY = 5;

const MAX_SHIP_HP = 3;
const MAX_LIVES   = 3;

const DROP_HEAL_CHANCE   = 0.08;
const DROP_DMG_CHANCE    = 0.12;
const DROP_SHIELD_CHANCE = 0.06;

// HUD 更新节流：每 N 帧最多触发一次 React 重渲染
const HUD_THROTTLE_FRAMES = 6;

// ─── Web Audio Sound Engine ────────────────────────────────────────────────────

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled = true;

  private getCtx(): AudioContext | null {
    if (!this.ctx) {
      try {
        const AudioContextClass = window.AudioContext ||
          (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return null;
        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.25;
        this.masterGain.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setEnabled(v: boolean) { this.enabled = v; }

  // 射击音：短促高频脉冲
  shoot(weaponLevel: number) {
    if (!this.enabled) return;
    const ctx = this.getCtx(); if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const freqs = [880, 1100, 1320, 660];
    const freq = freqs[Math.min(weaponLevel, 3)];
    const count = weaponLevel >= 2 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(this.masterGain);
      osc.type = weaponLevel === 3 ? 'sawtooth' : 'square';
      osc.frequency.setValueAtTime(freq + i * 80, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.4, now + 0.08);
      gain.gain.setValueAtTime(0.18, now + i * 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now + i * 0.02);
      osc.stop(now + 0.12);
    }
  }

  // 小爆炸音：低频噪声爆破
  explodeSmall() {
    if (!this.enabled) return;
    const ctx = this.getCtx(); if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 600;
    src.buffer = buf;
    src.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    src.start(now); src.stop(now + 0.15);
  }

  // Boss 爆炸音：更大更低沉
  explodeBoss() {
    if (!this.enabled) return;
    const ctx = this.getCtx(); if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    // 噪声层
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.5);
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 300;
    src.buffer = buf;
    src.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
    gain.gain.setValueAtTime(1.0, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    src.start(now); src.stop(now + 0.5);
    // 低频轰鸣
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.connect(og); og.connect(this.masterGain);
    osc.type = 'sine'; osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.4);
    og.gain.setValueAtTime(0.6, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.start(now); osc.stop(now + 0.4);
  }

  // 受击音：短促刺耳
  hit() {
    if (!this.enabled) return;
    const ctx = this.getCtx(); if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(this.masterGain);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.start(now); osc.stop(now + 0.12);
  }

  // 道具拾取音：上扬音调
  pickup(type: PowerupType) {
    if (!this.enabled) return;
    const ctx = this.getCtx(); if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const freqMap: Record<PowerupType, number[]> = {
      heal:   [523, 659, 784],
      shield: [440, 554, 659],
      damage: [880, 1108, 1318],
    };
    const freqs = freqMap[type];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(this.masterGain!);
      osc.type = 'sine';
      osc.frequency.value = f;
      const t = now + i * 0.08;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.start(t); osc.stop(t + 0.15);
    });
  }

  // 武器升级音：上升和弦
  weaponUpgrade() {
    if (!this.enabled) return;
    const ctx = this.getCtx(); if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    [523, 659, 784, 1046].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(this.masterGain!);
      osc.type = 'triangle'; osc.frequency.value = f;
      const t = now + i * 0.06;
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.start(t); osc.stop(t + 0.2);
    });
  }

  // 游戏结束音：下降悲鸣
  gameOver() {
    if (!this.enabled) return;
    const ctx = this.getCtx(); if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    [440, 349, 294, 220].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(this.masterGain!);
      osc.type = 'sawtooth'; osc.frequency.value = f;
      const t = now + i * 0.18;
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.start(t); osc.stop(t + 0.3);
    });
  }

  // 新波次音：鼓声
  newWave() {
    if (!this.enabled) return;
    const ctx = this.getCtx(); if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(this.masterGain);
    osc.type = 'sine'; osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.3);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.start(now); osc.stop(now + 0.3);
  }
}

// ─── Emoji OffscreenCanvas Cache ──────────────────────────────────────────────

const emojiCache = new Map<string, ImageBitmap | HTMLCanvasElement>();

async function getEmojiBitmap(emoji: string, size: number): Promise<ImageBitmap | HTMLCanvasElement> {
  const key = `${emoji}_${size}`;
  if (emojiCache.has(key)) return emojiCache.get(key)!;
  
  const offscreen = document.createElement('canvas');
  const padding = 10;
  offscreen.width = size + padding;
  offscreen.height = size + padding;
  const octx = offscreen.getContext('2d')!;
  octx.font = `${size}px Arial`;
  octx.textAlign = 'center';
  octx.textBaseline = 'middle';
  octx.fillText(emoji, (size + padding) / 2, (size + padding) / 2);
  
  try {
    const bitmap = await createImageBitmap(offscreen);
    emojiCache.set(key, bitmap);
    return bitmap;
  } catch (e) {
    emojiCache.set(key, offscreen);
    return offscreen;
  }
}

// ─── Performance detection ─────────────────────────────────────────────────────

function detectLowPerf(): boolean {
  // 检测低性能设备：移动端或内存不足
  const nav = navigator as Navigator & { deviceMemory?: number };
  if (nav.deviceMemory && nav.deviceMemory < 4) return true;
  if (nav.hardwareConcurrency && nav.hardwareConcurrency < 4) return true;
  // Firefox 在 shadowBlur 上性能较差，降级处理
  const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
  if (isFirefox) return true;
  return false;
}

// ─── Component ────────────────────────────────────────────────────────────────

const GameBackground = () => {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const hudRef      = useRef<HTMLDivElement>(null);
  const mouseRef    = useRef<Vec2>({ x: -100, y: -100 });
  const isActiveRef = useRef(false);
  const soundRef    = useRef(new SoundEngine());
  const [soundOn, setSoundOn] = useState(true);

  const [isActive, setIsActive] = useState(false);
  const [hudData, setHudData] = useState({
    score: 0, bestScore: 0,
    lives: MAX_LIVES,
    shipHp: MAX_SHIP_HP,
    combo: 0, wave: 1,
    weaponLevel: 0,
    weaponName: WEAPON_NAMES[0],
    weaponProgress: 0,
    damageBoost: 1,
    damageBoostTimer: 0,
    gameOver: false,
    waveAnnounce: '',
    upgradeAnnounce: '',
    hellMode: false,
    pickupAnnounce: '',
  });

  // 音效开关同步
  useEffect(() => {
    soundRef.current.setEnabled(soundOn);
  }, [soundOn]);

  useEffect(() => {
    const handleToggle = (e: CustomEvent<boolean>) => {
      setIsActive(e.detail);
      isActiveRef.current = e.detail;
    };
    window.addEventListener('toggleGame', handleToggle as EventListener);
    return () => window.removeEventListener('toggleGame', handleToggle as EventListener);
  }, []);

  useEffect(() => {
    const shouldHide = isActive && !hudData.gameOver;
    document.body.style.userSelect = isActive ? 'none' : '';
    document.body.style.cursor     = shouldHide ? 'none' : '';
    return () => { document.body.style.userSelect = ''; document.body.style.cursor = ''; };
  }, [isActive, hudData.gameOver]);

  // ─── Main game loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sound = soundRef.current;
    const lowPerf = detectLowPerf();

    let raf: number;

    let particles: Particle[] = [];
    let bullets:   Bullet[]   = [];
    let obstacles: Obstacle[] = [];
    let powerups:  Powerup[]  = [];
    let stars:     Star[]     = [];

    let score        = 0;
    let bestScore    = parseInt(localStorage.getItem('leo_best_score') || '0');
    let lives        = MAX_LIVES;
    let combo        = 0;
    let comboTimer   = 0;
    let wave         = 1;
    let waveTimer    = 0;
    let weaponLevel  = 0;
    let weaponXP     = 0;
    let weaponXPNext = 15;
    let gameOver     = false;
    let hellMode     = false;

    let waveAnnounceTimer    = 0;
    let upgradeAnnounceTimer = 0;
    let upgradeAnnounceName  = '';
    let pickupAnnounceTimer  = 0;
    let pickupAnnounceName   = '';

    let damageBoost      = 1;
    let damageBoostTimer = 0;

    // HUD 节流
    let hudThrottleCounter = 0;
    let hudDirty = false;

    // FPS 监测
    let frameCount = 0;
    let lastFpsUpdateTime = 0;
    let currentFps = 0;

    const ship = {
      alive: true,
      x: 0, y: 0,
      angle: 0, targetAngle: 0,
      respawnTimer: 0,
      invulnerable: 0,
      shooting: false,
      lastShot: 0,
      hp: MAX_SHIP_HP,
      hitFlash: 0,
    };

    // ── Init ──────────────────────────────────────────────────────────────────

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      ship.x = canvas.width  / 2;
      ship.y = canvas.height / 2;
      initStars();
    };

    const initStars = () => {
      stars = [];
      for (let i = 0; i < 160; i++) {
        const layer = Math.ceil(Math.random() * 3) as 1 | 2 | 3;
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size:  layer === 1 ? Math.random() * 0.8 : layer === 2 ? Math.random() * 1.4 + 0.5 : Math.random() * 2.2 + 1,
          alpha: Math.random() * 0.5 + 0.2,
          layer,
        });
      }
    };

    const resetGame = () => {
      score = 0; lives = MAX_LIVES; combo = 0; comboTimer = 0;
      wave = 1; waveTimer = 0; hellMode = false;
      weaponLevel = 0; weaponXP = 0; weaponXPNext = 15;
      gameOver = false;
      damageBoost = 1; damageBoostTimer = 0;
      particles = []; bullets = []; obstacles = []; powerups = [];
      ship.alive = true; ship.invulnerable = 120;
      ship.hp = MAX_SHIP_HP; ship.hitFlash = 0;
      ship.x = canvas.width / 2; ship.y = canvas.height / 2;
      markHudDirty();
    };

    // ── HUD 节流推送 ──────────────────────────────────────────────────────────
    const markHudDirty = () => { hudDirty = true; };

    const flushHUD = () => {
      if (!hudDirty) return;
      hudDirty = false;
      setHudData({
        score, bestScore, lives,
        shipHp: ship.hp,
        combo, wave, weaponLevel,
        weaponName: WEAPON_NAMES[Math.min(weaponLevel, 3)],
        weaponProgress: Math.round((weaponXP / weaponXPNext) * 100),
        damageBoost,
        damageBoostTimer,
        gameOver, hellMode,
        waveAnnounce:    waveAnnounceTimer   > 0 ? (hellMode ? `☠️ HELL WAVE ${wave}` : `WAVE ${wave}`) : '',
        upgradeAnnounce: upgradeAnnounceTimer > 0 ? `⚡ ${upgradeAnnounceName} UNLOCKED!` : '',
        pickupAnnounce:  pickupAnnounceTimer  > 0 ? pickupAnnounceName : '',
      });
    };

    // ── Particles ─────────────────────────────────────────────────────────────

    const spawnSparks = (x: number, y: number, count: number, colors: string[], speed = 5) => {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = Math.random() * speed + 1;
        particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, maxLife: 1, color: colors[Math.floor(Math.random() * colors.length)], size: Math.random() * 3 + 1, type: 'spark' });
      }
    };

    const spawnShockwave = (x: number, y: number, color: string) => {
      particles.push({ x, y, vx: 0, vy: 0, life: 1, maxLife: 1, color, size: 0, radius: 5, type: 'shockwave' });
    };

    const spawnDamageText = (x: number, y: number, text: string, color: string) => {
      particles.push({ x, y: y - 10, vx: (Math.random() - 0.5) * 1.5, vy: -1.8, life: 1, maxLife: 1, color, size: 14, type: 'damage', text });
    };

    const bigExplosion = (x: number, y: number, isBoss = false) => {
      const colors = isBoss ? ['#f97316', '#ef4444', '#fbbf24', '#ffffff', '#a78bfa'] : ['#f97316', '#ef4444', '#fbbf24', '#ffffff'];
      spawnSparks(x, y, isBoss ? 80 : 35, colors, isBoss ? 9 : 5);
      spawnShockwave(x, y, colors[0]);
      if (isBoss) spawnShockwave(x, y, '#ffffff');
    };

    // ── Powerup drop ──────────────────────────────────────────────────────────

    const tryDropPowerup = (x: number, y: number, isBoss: boolean) => {
      const roll = Math.random();
      const mult = isBoss ? 2.5 : 1;
      let type: PowerupType | null = null;
      if (roll < DROP_HEAL_CHANCE * mult && lives < MAX_LIVES) type = 'heal';
      else if (roll < (DROP_HEAL_CHANCE + DROP_SHIELD_CHANCE) * mult && ship.hp < MAX_SHIP_HP) type = 'shield';
      else if (roll < (DROP_HEAL_CHANCE + DROP_SHIELD_CHANCE + DROP_DMG_CHANCE) * mult) type = 'damage';
      if (!type) return;
      const cfg: Record<PowerupType, { emoji: string; label: string }> = {
        heal:   { emoji: '❤️',  label: '+1 Life' },
        shield: { emoji: '🛡️',  label: 'Shield +1' },
        damage: { emoji: '⚡',  label: 'DMG x2 (10s)' },
      };
      powerups.push({ x, y, vy: 0.6 + Math.random() * 0.4, type, emoji: cfg[type].emoji, label: cfg[type].label, life: 360, pulse: 0 });
    };

    // ── Obstacle speed ────────────────────────────────────────────────────────

    const calcSpeed = (isBoss: boolean) => {
      const base = 0.9 * Math.pow(1.15, wave - 1);
      return base * (isBoss ? 0.55 : 1);
    };

    // ── Spawn obstacle ────────────────────────────────────────────────────────

    const spawnObstacle = () => {
      if (obstacles.length >= MAX_OBSTACLES + Math.min(wave * 2, 30)) return;
      const isBoss = wave > 0 && wave % BOSS_WAVE_EVERY === 0 && obstacles.filter(o => o.isBoss).length === 0;
      const size   = isBoss ? 80 + Math.random() * 30 : 28 + Math.random() * 38;
      const speed  = calcSpeed(isBoss);
      const hp     = isBoss ? 20 + wave * 2 : Math.max(1, Math.floor((size - 20) / 10));
      const trackChance = Math.max(0, (wave - 9) * 0.12);
      const tracking = !isBoss && Math.random() < trackChance;
      const canShoot = wave >= 7 || isBoss;
      const shootInterval = isBoss ? Math.max(40, 120 - wave * 4) : Math.max(80, 200 - wave * 8);
      let x: number, y: number;
      if (Math.random() > 0.5) {
        x = Math.random() > 0.5 ? -size : canvas.width + size;
        y = Math.random() * canvas.height;
      } else {
        x = Math.random() * canvas.width;
        y = Math.random() > 0.5 ? -size : canvas.height + size;
      }
      const angle = Math.atan2(canvas.height / 2 - y, canvas.width / 2 - x) + (Math.random() - 0.5) * 1.2;
      const emoji = isBoss ? BOSS_EMOJIS[Math.floor(Math.random() * BOSS_EMOJIS.length)] : EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
      obstacles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        emoji,
        size,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.06,
        hp, maxHp: hp,
        hitFlash: 0,
        isBoss,
        tracking,
        shootTimer: canShoot ? Math.random() * shootInterval : Infinity,
        shootInterval: canShoot ? shootInterval : Infinity,
        cacheKey: `${emoji}_${Math.round(size)}`,
      });
    };

    // ── Splits ────────────────────────────────────────────────────────────────

    const spawnSplits = (obs: Obstacle) => {
      if (obs.isBoss || obs.size < 36) return;
      const count = 2;
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = calcSpeed(false) * 1.3;
        const newSize = obs.size * 0.55;
        const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
        obstacles.push({
          x: obs.x + Math.cos(a) * 20, y: obs.y + Math.sin(a) * 20,
          vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
          emoji, size: newSize,
          angle: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 0.08,
          hp: 1, maxHp: 1, hitFlash: 0,
          isBoss: false, tracking: false,
          shootTimer: Infinity, shootInterval: Infinity,
          cacheKey: `${emoji}_${Math.round(newSize)}`,
        });
      }
    };

    // ── Ship damage ───────────────────────────────────────────────────────────

    const shipTakeDamage = () => {
      sound.hit();
      ship.hp--;
      ship.hitFlash = 15;
      ship.invulnerable = 90;
      if (ship.hp <= 0) {
        ship.alive = false;
        lives--;
        bigExplosion(ship.x, ship.y);
        if (lives <= 0) {
          gameOver = true;
          sound.gameOver();
        } else {
          ship.respawnTimer = 90;
        }
        markHudDirty();
      } else {
        markHudDirty();
      }
    };

    // ── Enemy shoot ───────────────────────────────────────────────────────────

    const enemyShoot = (obs: Obstacle) => {
      if (!ship.alive) return;
      const a = Math.atan2(ship.y - obs.y, ship.x - obs.x);
      const spd = 3.5 + wave * 0.15;
      bullets.push({ x: obs.x, y: obs.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 120, trail: [], level: 0, isEnemy: true });
    };

    // ── Shoot ─────────────────────────────────────────────────────────────────

    const shoot = () => {
      const now = Date.now();
      const rate = Math.max(60, 200 - weaponLevel * 40);
      if (now - ship.lastShot < rate) return;
      ship.lastShot = now;
      const a = ship.angle;
      const spd = 14 + weaponLevel * 2;
      sound.shoot(weaponLevel);
      if (weaponLevel === 0) {
        bullets.push({ x: ship.x, y: ship.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 60, trail: [], level: 0 });
      } else if (weaponLevel === 1) {
        [-0.15, 0.15].forEach(offset => {
          bullets.push({ x: ship.x, y: ship.y, vx: Math.cos(a + offset) * spd, vy: Math.sin(a + offset) * spd, life: 60, trail: [], level: 1 });
        });
      } else if (weaponLevel === 2) {
        [-0.2, 0, 0.2].forEach(offset => {
          bullets.push({ x: ship.x, y: ship.y, vx: Math.cos(a + offset) * spd, vy: Math.sin(a + offset) * spd, life: 60, trail: [], level: 2 });
        });
      } else {
        // Level 3 BEAM: 三排紧密高速子弹
        const bspd = spd * 1.3;
        for (let i = -1; i <= 1; i++) {
          bullets.push({ x: ship.x, y: ship.y, vx: Math.cos(a + i * 0.06) * bspd, vy: Math.sin(a + i * 0.06) * bspd, life: 70, trail: [], level: 3 });
        }
      }
    };

    // ── Draw: Ship ────────────────────────────────────────────────────────────

    const drawShip = () => {
      if (!ship.alive) return;
      const { x, y, angle, invulnerable, hitFlash } = ship;
      if (invulnerable > 0 && Math.floor(invulnerable / 6) % 2 === 0) return;

      if (hitFlash > 0) ctx.globalAlpha = 0.7;

      // Shield ring (shows remaining HP)
      if (ship.hp < MAX_SHIP_HP && ship.hp > 0) {
        const shieldColor = ship.hp === 2 ? '#fbbf24' : '#ef4444';
        ctx.beginPath();
        ctx.arc(x, y, 24, 0, Math.PI * 2 * (ship.hp / MAX_SHIP_HP));
        ctx.strokeStyle = shieldColor;
        ctx.lineWidth = 2;
        if (!lowPerf) { ctx.shadowBlur = 8; ctx.shadowColor = shieldColor; }
        ctx.stroke();
        if (!lowPerf) ctx.shadowBlur = 0;
        ctx.lineWidth = 1;
      } else if (ship.hp === MAX_SHIP_HP) {
        ctx.beginPath();
        ctx.arc(x, y, 24, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(34,211,238,0.25)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.lineWidth = 1;
      }
      // Damage boost aura
      if (damageBoost > 1) {
        ctx.beginPath();
        ctx.arc(x, y, 28 + Math.sin(Date.now() / 150) * 3, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(236,72,153,${0.4 + Math.sin(Date.now() / 150) * 0.2})`;
        ctx.lineWidth = 2;
        if (!lowPerf) { ctx.shadowBlur = 12; ctx.shadowColor = '#ec4899'; }
        ctx.stroke();
        if (!lowPerf) ctx.shadowBlur = 0;
        ctx.lineWidth = 1;
      }
      // 🚀 Emoji ship
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + Math.PI / 4);
      ctx.font = '28px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🚀', 0, 0);
      ctx.globalAlpha = 1;
      ctx.restore();
    };

    // ── Draw: Bullets ─────────────────────────────────────────────────────────

    const drawBullets = () => {
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.trail.unshift({ x: b.x, y: b.y });
        if (b.trail.length > 8) b.trail.pop();
        b.x += b.vx; b.y += b.vy; b.life--;

        if (b.life <= 0 || b.x < -20 || b.x > canvas.width + 20 || b.y < -20 || b.y > canvas.height + 20) {
          bullets.splice(i, 1); continue;
        }

        const col = b.isEnemy ? '#ff4444' : (damageBoost > 1 ? '#ec4899' : WEAPON_COLORS[Math.min(b.level, 3)]);

        for (let t = 0; t < b.trail.length; t++) {
          ctx.globalAlpha = (1 - t / b.trail.length) * 0.5;
          ctx.beginPath();
          ctx.arc(b.trail[t].x, b.trail[t].y, b.isEnemy ? 2 : 2.5 - t * 0.25, 0, Math.PI * 2);
          ctx.fillStyle = col; ctx.fill();
        }
        ctx.globalAlpha = 1;

        if (!lowPerf) { ctx.shadowBlur = b.isEnemy ? 10 : (damageBoost > 1 ? 20 : 14); ctx.shadowColor = col; }
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.isEnemy ? 3.5 : (b.level === 3 ? 4 : 3), 0, Math.PI * 2);
        ctx.fillStyle = col; ctx.fill();
        if (!lowPerf) ctx.shadowBlur = 0;

        if (b.isEnemy && ship.alive && ship.invulnerable <= 0) {
          const dx = b.x - ship.x, dy = b.y - ship.y;
          if (Math.sqrt(dx * dx + dy * dy) < 16) {
            bullets.splice(i, 1);
            shipTakeDamage();
          }
        }
      }
    };

    // ── Draw: Powerups ────────────────────────────────────────────────────────

    const drawPowerups = () => {
      for (let i = powerups.length - 1; i >= 0; i--) {
        const p = powerups[i];
        p.y += p.vy; p.life--; p.pulse++;
        if (p.life <= 0 || p.y > canvas.height + 40) { powerups.splice(i, 1); continue; }
        const alpha = p.life < 60 ? p.life / 60 : 1;
        const scale = 1 + Math.sin(p.pulse * 0.1) * 0.1;
        const glowColor = p.type === 'heal' ? '#ef4444' : p.type === 'shield' ? '#22d3ee' : '#ec4899';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 20 * scale, 0, Math.PI * 2);
        ctx.strokeStyle = glowColor;
        ctx.globalAlpha = alpha * 0.6;
        ctx.lineWidth = 2;
        if (!lowPerf) { ctx.shadowBlur = 16; ctx.shadowColor = glowColor; }
        ctx.stroke();
        if (!lowPerf) ctx.shadowBlur = 0;
        ctx.lineWidth = 1;
        ctx.globalAlpha = alpha;
        ctx.font = `${22 * scale}px Arial`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(p.emoji, p.x, p.y);
        ctx.globalAlpha = 1;

        if (ship.alive) {
          const dx = p.x - ship.x, dy = p.y - ship.y;
          if (Math.sqrt(dx * dx + dy * dy) < 28) {
            if (p.type === 'heal') { lives = Math.min(lives + 1, MAX_LIVES); pickupAnnounceName = '❤️ +1 Life!'; }
            else if (p.type === 'shield') { ship.hp = Math.min(ship.hp + 1, MAX_SHIP_HP); pickupAnnounceName = '🛡️ Shield Restored!'; }
            else if (p.type === 'damage') { damageBoost = 2; damageBoostTimer = 600; pickupAnnounceName = '⚡ DMG x2 (10s)!'; }
            pickupAnnounceTimer = 150;
            sound.pickup(p.type);
            spawnSparks(p.x, p.y, 20, [glowColor, '#ffffff'], 5);
            spawnShockwave(p.x, p.y, glowColor);
            powerups.splice(i, 1);
            markHudDirty();
          }
        }
      }
    };

    // ── Draw: Obstacles ───────────────────────────────────────────────────────

    const drawObstacles = () => {
      spawnObstacle();

      for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];

        if (obs.tracking && ship.alive) {
          const ta = Math.atan2(ship.y - obs.y, ship.x - obs.x);
          const spd = Math.sqrt(obs.vx * obs.vx + obs.vy * obs.vy);
          const currentA = Math.atan2(obs.vy, obs.vx);
          const diff = Math.atan2(Math.sin(ta - currentA), Math.cos(ta - currentA));
          const turnRate = 0.04 + wave * 0.003;
          const newA = currentA + diff * Math.min(turnRate, 0.12);
          obs.vx = Math.cos(newA) * spd; obs.vy = Math.sin(newA) * spd;
        }

        obs.x += obs.vx; obs.y += obs.vy;
        obs.angle += obs.spin;
        if (obs.hitFlash > 0) obs.hitFlash--;

        if (obs.x < -120) obs.x = canvas.width  + 120;
        if (obs.x > canvas.width  + 120) obs.x = -120;
        if (obs.y < -120) obs.y = canvas.height + 120;
        if (obs.y > canvas.height + 120) obs.y = -120;

        obs.shootTimer--;
        if (obs.shootTimer <= 0) { obs.shootTimer = obs.shootInterval; enemyShoot(obs); }

        for (let j = bullets.length - 1; j >= 0; j--) {
          const b = bullets[j];
          if (b.isEnemy) continue;
          const dx = b.x - obs.x, dy = b.y - obs.y;
          if (Math.sqrt(dx * dx + dy * dy) < obs.size / 2) {
            bullets.splice(j, 1);
            const dmg = damageBoost;
            obs.hp -= dmg;
            obs.hitFlash = 6;
            spawnSparks(b.x, b.y, 6, [damageBoost > 1 ? '#ec4899' : WEAPON_COLORS[Math.min(weaponLevel, 3)]], 3);

            if (obs.hp <= 0) {
              const pts = obs.isBoss ? 150 : Math.round(obs.size);
              const multiplier = combo > 4 ? 3 : combo > 2 ? 2 : 1;
              const earned = pts * multiplier;
              score += earned;
              if (score > bestScore) { bestScore = score; localStorage.setItem('leo_best_score', String(bestScore)); }
              combo++; comboTimer = 120;
              weaponXP++;
              if (weaponLevel < 3 && weaponXP >= weaponXPNext) {
                weaponLevel++; weaponXP = 0; weaponXPNext = 15 + weaponLevel * 10;
                upgradeAnnounceName = WEAPON_NAMES[weaponLevel]; upgradeAnnounceTimer = 180;
                sound.weaponUpgrade();
              }
              spawnDamageText(obs.x, obs.y - obs.size / 2, multiplier > 1 ? `+${earned} x${multiplier}!` : `+${earned}`, obs.isBoss ? '#f97316' : '#22d3ee');
              spawnSplits(obs);
              tryDropPowerup(obs.x, obs.y, obs.isBoss);
              bigExplosion(obs.x, obs.y, obs.isBoss);
              if (obs.isBoss) sound.explodeBoss(); else sound.explodeSmall();
              obstacles.splice(i, 1);
              markHudDirty();
              break;
            }
          }
        }

        if (!obstacles[i] || obstacles[i] !== obs) continue;

        ctx.save();
        ctx.translate(obs.x, obs.y);
        ctx.rotate(obs.angle);

        if (obs.hitFlash > 0) {
          ctx.globalAlpha = 0.6; ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(0, 0, obs.size / 2, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }

        if (!lowPerf) {
          if (obs.isBoss) { ctx.shadowBlur = 30; ctx.shadowColor = '#f97316'; }
          else if (obs.tracking) { ctx.shadowBlur = 16; ctx.shadowColor = '#ef4444'; }
          else if (hellMode) { ctx.shadowBlur = 8; ctx.shadowColor = '#dc2626'; }
        }

        // 使用缓存的 ImageBitmap 渲染 Emoji（GPU 加速位图绘制）
        const key = `${obs.emoji}_${Math.round(obs.size)}`;
        const cached = emojiCache.get(key);
        if (cached) {
          const ew = cached.width;
          ctx.drawImage(cached, -ew / 2, -ew / 2);
        } else {
          // 异步触发加载，本帧先跳过或用简单形状占位
          getEmojiBitmap(obs.emoji, Math.round(obs.size));
        }

        if (!lowPerf) ctx.shadowBlur = 0;

        if (obs.hp < obs.maxHp) {
          const bw = obs.isBoss ? 60 : 40, bh = obs.isBoss ? 6 : 4;
          const by2 = -obs.size / 2 - 12;
          ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-bw / 2, by2, bw, bh);
          ctx.fillStyle = obs.isBoss ? '#f97316' : '#22c55e';
          ctx.fillRect(-bw / 2, by2, bw * (obs.hp / obs.maxHp), bh);
        }
        ctx.restore();

        if (ship.alive && ship.invulnerable <= 0) {
          const dx = obs.x - ship.x, dy = obs.y - ship.y;
          if (Math.sqrt(dx * dx + dy * dy) < obs.size / 2 + 12) {
            shipTakeDamage();
          }
        }
      }
    };

    // ── Draw: Particles ───────────────────────────────────────────────────────

    const drawParticles = () => {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        const decay = p.type === 'shockwave' ? 0.025 : p.type === 'damage' ? 0.012 : 0.018;
        p.life -= decay;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        const t = p.life / p.maxLife;

        if (p.type === 'shockwave') {
          const r = (p.radius ?? 5) + (1 - p.life) * 120;
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.strokeStyle = p.color; ctx.globalAlpha = p.life * 0.6; ctx.lineWidth = 2; ctx.stroke();
          ctx.globalAlpha = 1; ctx.lineWidth = 1; p.radius = r;
        } else if (p.type === 'damage') {
          p.x += p.vx; p.y += p.vy;
          ctx.globalAlpha = p.life; ctx.font = `bold ${p.size}px monospace`;
          ctx.fillStyle = p.color; ctx.textAlign = 'center';
          if (!lowPerf) { ctx.shadowBlur = 8; ctx.shadowColor = p.color; }
          ctx.fillText(p.text ?? '', p.x, p.y);
          if (!lowPerf) ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        } else {
          p.x += p.vx; p.y += p.vy; p.vx *= 0.96; p.vy *= 0.96;
          ctx.globalAlpha = t; ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    };

    // ── Draw: Stars ───────────────────────────────────────────────────────────

    const drawStars = () => {
      const mx = (mouseRef.current.x / canvas.width  - 0.5) * 2;
      const my = (mouseRef.current.y / canvas.height - 0.5) * 2;
      for (const s of stars) {
        const px = [0, 0.3, 0.8, 1.8][s.layer];
        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = hellMode ? '#ff9999' : '#ffffff';
        ctx.beginPath(); ctx.arc(s.x + mx * px * 12, s.y + my * px * 12, s.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    // ── Main loop ───────────────────────────────────
    let lastTime = 0;
    const loop = (ts: number) => {
      if (!isActiveRef.current) return;
      raf = requestAnimationFrame(loop);
      const dt = ts - lastTime; lastTime = ts;

      // FPS 计算
      frameCount++;
      if (ts - lastFpsUpdateTime >= 1000) {
        currentFps = frameCount;
        frameCount = 0;
        lastFpsUpdateTime = ts;
        markHudDirty();
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (hellMode) { ctx.fillStyle = 'rgba(80,0,0,0.15)'; ctx.fillRect(0, 0, canvas.width, canvas.height); }

      if (!isActive) { obstacles = []; bullets = []; particles = []; powerups = []; return; }

      drawStars();
      if (gameOver) {
        // 强制立即 flush，确保 gameOver 状态同步到 React（不受节流影响）
        hudDirty = true;
        flushHUD();
        return;
      }

      // Wave timer
      waveTimer += dt;
      if (waveTimer >= WAVE_INTERVAL) {
        waveTimer = 0; wave++;
        if (wave >= 10 && !hellMode) hellMode = true;
        waveAnnounceTimer = 180;
        sound.newWave();
        markHudDirty();
      }
      if (waveAnnounceTimer   > 0) { waveAnnounceTimer--;   if (waveAnnounceTimer   === 0) markHudDirty(); }
      if (upgradeAnnounceTimer > 0) { upgradeAnnounceTimer--; if (upgradeAnnounceTimer === 0) markHudDirty(); }
      if (pickupAnnounceTimer  > 0) { pickupAnnounceTimer--;  if (pickupAnnounceTimer  === 0) markHudDirty(); }

      if (damageBoostTimer > 0) {
        damageBoostTimer--;
        if (damageBoostTimer === 0) { damageBoost = 1; markHudDirty(); }
        else if (damageBoostTimer % 60 === 0) markHudDirty();
      }

      if (comboTimer > 0) { comboTimer--; if (comboTimer === 0) { combo = 0; markHudDirty(); } }

      if (ship.alive) {
        const dx = mouseRef.current.x - ship.x, dy = mouseRef.current.y - ship.y;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) ship.targetAngle = Math.atan2(dy, dx);
        const diff = Math.atan2(Math.sin(ship.targetAngle - ship.angle), Math.cos(ship.targetAngle - ship.angle));
        ship.angle += diff * 0.1;
        ship.x += dx * 0.12; ship.y += dy * 0.12;
        if (ship.invulnerable > 0) ship.invulnerable--;
        if (ship.shooting) shoot();
      } else {
        ship.respawnTimer--;
        if (ship.respawnTimer <= 0) {
          ship.alive = true; ship.invulnerable = 120;
          ship.hp = MAX_SHIP_HP;
          ship.x = mouseRef.current.x; ship.y = mouseRef.current.y;
          markHudDirty();
        }
      }

      drawBullets();
      drawObstacles();
      drawPowerups();
      drawParticles();
      drawShip();

      // 🚀 Canvas 原生 FPS 渲染（确保在所有 React 遮挡之上）
      ctx.save();
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const fpsColor = currentFps >= 55 ? '#22c55e' : currentFps >= 45 ? '#eab308' : '#ef4444';
      ctx.fillStyle = fpsColor;
      ctx.shadowBlur = 4;
      ctx.shadowColor = fpsColor;
      ctx.fillText(`FPS: ${currentFps}`, 20, 20);
      ctx.restore();

      // HUD 节流：每 HUD_THROTTLE_FRAMES 帧最多 flush 一次
      hudThrottleCounter++;
      if (hudThrottleCounter >= HUD_THROTTLE_FRAMES) {
        hudThrottleCounter = 0;
        flushHUD();
      }
    };

    // ── Events ────────────────────────────────────────────────────────────────

    const onMove  = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    const onDown  = () => { ship.shooting = true; };
    const onUp    = () => { ship.shooting = false; };
    const onKey   = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); ship.shooting = true; }
      if ((e.code === 'Enter' || e.code === 'KeyR') && gameOver) resetGame();
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') ship.shooting = false; };

    window.addEventListener('resize',    resize);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup',   onUp);
    window.addEventListener('keydown',   onKey);
    window.addEventListener('keyup',     onKeyUp);

    resize(); resetGame(); raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize',    resize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup',   onUp);
      window.removeEventListener('keydown',   onKey);
      window.removeEventListener('keyup',     onKeyUp);
    };
  }, [isActive]);  // isActive 变化时重建游戏循环

  if (!isActive) return null;

  // ─── HUD Overlay ────────────────────────────────────────────────────────────
  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full pointer-events-none z-[-1]"
        style={{ 
          cursor: hudData.gameOver ? 'default' : 'none',
          transform: 'translateZ(0)',
          willChange: 'transform'
        }}
      />

      <div
        ref={hudRef}
        className="fixed inset-0 pointer-events-none z-[5] font-mono select-none"
        style={{ cursor: hudData.gameOver ? 'default' : 'none' }}
      >
        {/* Top-left: Score */}
        <div className="absolute top-20 left-6 flex flex-col gap-1">
          <div className="text-white/30 text-[10px] uppercase tracking-widest">Score</div>
          <div className="text-2xl font-bold tabular-nums"
            style={{ color: hudData.hellMode ? '#ff6666' : '#fff', textShadow: `0 0 12px ${hudData.hellMode ? '#ef4444' : '#22d3ee'}` }}>
            {hudData.score.toLocaleString()}
          </div>
          <div className="text-white/30 text-[10px]">BEST {hudData.bestScore.toLocaleString()}</div>
        </div>

        {/* Top-center: Wave announce */}
        {hudData.waveAnnounce && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 text-center">
            <div className="text-3xl font-bold tracking-[0.3em] animate-pulse"
              style={{ color: hudData.hellMode ? '#ef4444' : '#f97316', textShadow: `0 0 20px ${hudData.hellMode ? '#ef4444' : '#f97316'}` }}>
              {hudData.waveAnnounce}
            </div>
          </div>
        )}

        {/* Hell mode indicator */}
        {hudData.hellMode && !hudData.waveAnnounce && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2">
            <div className="text-[10px] font-bold text-red-500/60 tracking-[0.4em] uppercase animate-pulse">☠ HELL MODE ☠</div>
          </div>
        )}

        {/* Top-right: Lives + Wave + Ship HP */}
        <div className="absolute top-20 right-6 flex flex-col items-end gap-1.5">
          <div className="text-white/30 text-[10px] uppercase tracking-widest">Wave {hudData.wave}</div>
          <div className="flex gap-1.5">
            {Array.from({ length: MAX_LIVES }).map((_, i) => (
              <span key={i} className={`text-lg transition-all duration-300 ${i < hudData.lives ? 'opacity-100' : 'opacity-15'}`}>❤️</span>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-white/30 text-[10px]">Shield</span>
            <div className="flex gap-1">
              {Array.from({ length: MAX_SHIP_HP }).map((_, i) => (
                <div key={i}
                  className={`w-3 h-3 rounded-full border transition-all duration-200 ${
                    i < hudData.shipHp
                      ? hudData.shipHp === 3 ? 'bg-cyan-400 border-cyan-400 shadow-[0_0_6px_#22d3ee]'
                        : hudData.shipHp === 2 ? 'bg-yellow-400 border-yellow-400 shadow-[0_0_6px_#fbbf24]'
                        : 'bg-red-500 border-red-500 shadow-[0_0_6px_#ef4444] animate-pulse'
                      : 'bg-transparent border-white/20'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Bottom-left: Weapon + Sound toggle */}
        <div className="absolute bottom-8 left-6 flex flex-col gap-1.5">
          <div className="text-white/30 text-[10px] uppercase tracking-widest">Weapon</div>
          <div className="flex items-center gap-2">
            <span>{['⚡', '⚡⚡', '⚡⚡⚡', '🔆'][hudData.weaponLevel]}</span>
            <span className="text-xs text-white/70">{hudData.weaponName}</span>
            {hudData.damageBoost > 1 && (
              <span className="text-xs font-bold text-pink-400 animate-pulse" style={{ textShadow: '0 0 8px #ec4899' }}>
                ×2 DMG
              </span>
            )}
          </div>
          {hudData.weaponLevel < 3 && (
            <div className="w-28 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300"
                style={{ width: `${hudData.weaponProgress}%`, background: WEAPON_COLORS[hudData.weaponLevel], boxShadow: `0 0 6px ${WEAPON_COLORS[hudData.weaponLevel]}` }} />
            </div>
          )}
          {hudData.weaponLevel === 3 && <div className="text-[10px] text-pink-400" style={{ textShadow: '0 0 8px #ec4899' }}>MAX LEVEL</div>}
          {hudData.damageBoost > 1 && (
            <div className="w-28 h-1 rounded-full bg-white/10 overflow-hidden mt-0.5">
              <div className="h-full rounded-full bg-pink-500 transition-all duration-1000"
                style={{ width: `${(hudData.damageBoostTimer / 600) * 100}%`, boxShadow: '0 0 6px #ec4899' }} />
            </div>
          )}
          {/* 音效开关按钮 */}
          <button
            className="pointer-events-auto mt-1 flex items-center gap-1.5 text-[10px] text-white/40 hover:text-white/70 transition-colors cursor-pointer"
            onClick={() => setSoundOn(v => !v)}
          >
            <span>{soundOn ? '🔊' : '🔇'}</span>
            <span>{soundOn ? 'SFX ON' : 'SFX OFF'}</span>
          </button>
        </div>

        {/* Bottom-center: Combo */}
        {hudData.combo > 1 && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
            <div className="text-yellow-300 text-lg font-bold" style={{ textShadow: '0 0 12px #fbbf24' }}>COMBO x{hudData.combo}</div>
          </div>
        )}

        {/* Weapon upgrade announce */}
        {hudData.upgradeAnnounce && (
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 text-center">
            <div className="text-2xl font-bold text-purple-300 tracking-widest animate-pulse" style={{ textShadow: '0 0 20px #a78bfa' }}>
              {hudData.upgradeAnnounce}
            </div>
          </div>
        )}

        {/* Pickup announce */}
        {hudData.pickupAnnounce && (
          <div className="absolute top-2/5 left-1/2 -translate-x-1/2 text-center">
            <div className="text-xl font-bold text-green-300 tracking-widest animate-pulse" style={{ textShadow: '0 0 16px #4ade80' }}>
              {hudData.pickupAnnounce}
            </div>
          </div>
        )}

        {/* Controls hint */}
        <div className="absolute bottom-8 right-6 text-right text-[10px] text-white/20 leading-relaxed">
          <div>移动鼠标 → 控制飞船</div>
          <div>按住左键 / 空格 → 射击</div>
          <div>拾取道具 → 增强战力</div>
          <div>Wave 10+ → ☠ 地狱模式</div>
        </div>
      </div>

      {/* Game Over overlay */}
      {hudData.gameOver && (
        <div className="fixed inset-0 z-[50] flex flex-col items-center justify-center bg-black/70 font-mono" style={{ cursor: 'default' }}>
          <div className="text-5xl font-bold text-red-400 mb-3 tracking-widest" style={{ textShadow: '0 0 30px #ef4444' }}>GAME OVER</div>
          {hudData.hellMode && <div className="text-sm text-red-500/70 mb-2 tracking-widest">☠ You survived HELL MODE ☠</div>}
          <div className="text-white/60 text-lg mb-1">Score: <span className="text-white font-bold">{hudData.score.toLocaleString()}</span></div>
          <div className="text-white/40 text-sm mb-2">Best: {hudData.bestScore.toLocaleString()}</div>
          <div className="text-white/30 text-xs mb-8">Wave {hudData.wave} reached</div>
          <button
            className="px-8 py-3 rounded-full border border-orange-500/50 text-orange-300 bg-orange-500/10 hover:bg-orange-500/20 transition-all text-sm tracking-widest cursor-pointer"
            onClick={() => {
              const e1 = new CustomEvent('toggleGame', { detail: false });
              window.dispatchEvent(e1);
              setTimeout(() => { const e2 = new CustomEvent('toggleGame', { detail: true }); window.dispatchEvent(e2); }, 100);
            }}
          >
            RESTART
          </button>
          <p className="text-white/20 text-xs mt-4">Press R or Enter to restart</p>
        </div>
      )}
    </>
  );
};

export default GameBackground;
