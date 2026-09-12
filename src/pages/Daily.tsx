import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Camera, Heart, MapPin, X, ChevronLeft, ChevronRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import ParticleBackground from "@/components/ParticleBackground";
import { useState, useEffect, useCallback } from "react";

import daily2 from "@/assets/daily-2.jpg";
import daily3 from "@/assets/daily-3.jpg";
import daily4 from "@/assets/daily-4.jpg";
import daily5 from "@/assets/daily-5.jpg";
import daily6 from "@/assets/daily-6.jpg";
import daily7 from "@/assets/daily-7.jpg";

const photos = [
  { id: 2, url: daily2, caption: "老君山上吃泡面 🍝", location: "Mountain" },
  { id: 3, url: daily3, caption: "妹妹弹古筝给我听 🎶", location: "Music" },
  { id: 4, url: daily4, caption: "深夜的实验室 🧪", location: "Lab" },
  { id: 5, url: daily5, caption: "西岛两日游 🥽", location: "Travel" },
  { id: 6, url: daily6, caption: "朋友赠书 📚", location: "Reading" },
  { id: 7, url: daily7, caption: "可爱的小狗 🐕", location: "Pet" },
];

// 方案A 布局：2-1-2-1
// Row 1: photo[0] + photo[1]  各 50%，aspect-ratio 4/3
// Row 2: photo[2]             全宽横幅，aspect-ratio 21/8
// Row 3: photo[3] + photo[4]  各 50%，aspect-ratio 4/3
// Row 4: photo[5]             全宽横幅，aspect-ratio 21/8

const PhotoCard = ({
  photo,
  index,
  aspectClass,
  onClick,
  liked,
  onLike,
}: {
  photo: typeof photos[0];
  index: number;
  aspectClass: string;
  onClick: () => void;
  liked: boolean;
  onLike: (e: React.MouseEvent) => void;
}) => (
  <motion.div
    className="relative group cursor-pointer overflow-hidden rounded-2xl bg-white/5 border border-white/10 hover:border-amber-500/30 hover:shadow-[0_0_40px_rgba(251,191,36,0.08)] transition-all duration-500"
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay: index * 0.08 }}
    onClick={onClick}
  >
    {/* 图片容器：固定宽高比 */}
    <div className={`w-full ${aspectClass} overflow-hidden`}>
      <img
        src={photo.url}
        alt={photo.caption}
        className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
      />
    </div>

    {/* 悬停遮罩 */}
    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-5">
      <div className="flex items-center gap-1.5 text-amber-400 mb-1.5">
        <MapPin className="w-3.5 h-3.5" />
        <span className="text-xs font-mono uppercase tracking-widest">{photo.location}</span>
      </div>
      <h3 className="text-white text-base font-semibold mb-3 leading-snug">{photo.caption}</h3>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-white/60">
          <button
            className={`hover:text-red-400 transition-colors flex items-center gap-1 ${liked ? "text-red-400" : ""}`}
            onClick={onLike}
          >
            <Heart className={`w-4 h-4 transition-all ${liked ? "fill-red-400 scale-110" : ""}`} />
            <span className="text-xs font-mono">{liked ? 25 : 24}</span>
          </button>
          <span className="flex items-center gap-1 text-white/40">
            <Camera className="w-4 h-4" />
            <span className="text-xs font-mono">查看大图</span>
          </span>
        </div>
        <span className="text-xs font-mono text-white/25">{index + 1}/{photos.length}</span>
      </div>
    </div>
  </motion.div>
);

const Daily = () => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);

  const goPrev = useCallback(() => {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex - 1 + photos.length) % photos.length);
  }, [lightboxIndex]);

  const goNext = useCallback(() => {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex + 1) % photos.length);
  }, [lightboxIndex]);

  const toggleLike = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setLikedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxIndex, goPrev, goNext]);

  useEffect(() => {
    document.body.style.overflow = lightboxIndex !== null ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [lightboxIndex]);

  const currentPhoto = lightboxIndex !== null ? photos[lightboxIndex] : null;

  return (
    <motion.div
      className="relative min-h-screen bg-background text-foreground overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      <ParticleBackground />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/20 to-background pointer-events-none" />

      <Navbar />

      <main className="relative z-10 container mx-auto px-8 pt-32 pb-24 max-w-5xl">
        <a
          href="/#about"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-12 py-2 px-4 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4" />
          返回首页
        </a>

        <motion.header
          className="mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="font-serif text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-amber-100 via-orange-50 to-amber-100 bg-clip-text text-transparent">
            日常点滴
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed">
            在这里记录生活中的琐碎与美好，每一张照片都是一段独特的回忆。
          </p>
          <p className="mt-3 font-mono text-xs text-muted-foreground/40">
            {photos.length} 张记忆 · 悬停查看详情 · 点击查看大图
          </p>
        </motion.header>

        {/* ── 方案A 固定网格 ── */}
        <div className="flex flex-col gap-4">

          {/* Row 1: 两列等宽 */}
          <div className="grid grid-cols-2 gap-4">
            <PhotoCard photo={photos[0]} index={0} aspectClass="aspect-[4/3]"
              onClick={() => openLightbox(0)} liked={likedIds.has(photos[0].id)}
              onLike={(e) => toggleLike(photos[0].id, e)} />
            <PhotoCard photo={photos[1]} index={1} aspectClass="aspect-[4/3]"
              onClick={() => openLightbox(1)} liked={likedIds.has(photos[1].id)}
              onLike={(e) => toggleLike(photos[1].id, e)} />
          </div>

          {/* Row 2: 全宽横幅 */}
          <PhotoCard photo={photos[2]} index={2} aspectClass="aspect-[21/8]"
            onClick={() => openLightbox(2)} liked={likedIds.has(photos[2].id)}
            onLike={(e) => toggleLike(photos[2].id, e)} />

          {/* Row 3: 两列等宽 */}
          <div className="grid grid-cols-2 gap-4">
            <PhotoCard photo={photos[3]} index={3} aspectClass="aspect-[4/3]"
              onClick={() => openLightbox(3)} liked={likedIds.has(photos[3].id)}
              onLike={(e) => toggleLike(photos[3].id, e)} />
            <PhotoCard photo={photos[4]} index={4} aspectClass="aspect-[4/3]"
              onClick={() => openLightbox(4)} liked={likedIds.has(photos[4].id)}
              onLike={(e) => toggleLike(photos[4].id, e)} />
          </div>

          {/* Row 4: 全宽横幅 */}
          <PhotoCard photo={photos[5]} index={5} aspectClass="aspect-[21/8]"
            onClick={() => openLightbox(5)} liked={likedIds.has(photos[5].id)}
            onLike={(e) => toggleLike(photos[5].id, e)} />

        </div>
      </main>

      <footer className="relative z-10 border-t border-white/5 py-12 text-center">
        <p className="text-muted-foreground text-sm font-mono">
          — 保持热爱，奔赴山海 —
        </p>
      </footer>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && currentPhoto && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeLightbox}
          >
            <button
              className="absolute top-6 right-6 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              onClick={closeLightbox}
            >
              <X className="w-6 h-6" />
            </button>

            <div className="absolute top-6 left-6 z-10 font-mono text-sm text-white/50">
              {lightboxIndex + 1} / {photos.length}
            </div>

            <button
              className="absolute left-4 md:left-8 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <motion.div
              key={currentPhoto.id}
              className="relative max-w-4xl max-h-[85vh] mx-16 flex flex-col items-center"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.22 }}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={currentPhoto.url}
                alt={currentPhoto.caption}
                className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl"
              />
              <div className="mt-4 text-center">
                <div className="flex items-center justify-center gap-2 text-amber-400 mb-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="text-xs font-mono uppercase tracking-widest">{currentPhoto.location}</span>
                </div>
                <h3 className="text-white text-lg font-medium">{currentPhoto.caption}</h3>
              </div>
            </motion.div>

            <button
              className="absolute right-4 md:right-8 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); goNext(); }}
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-xs text-white/20 flex gap-4">
              <span>← → 切换</span>
              <span>ESC 关闭</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Daily;
