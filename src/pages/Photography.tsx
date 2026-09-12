import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Aperture, X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import ParticleBackground from "@/components/ParticleBackground";
import { useState, useEffect, useCallback } from "react";

import photo1 from "@/assets/photo-1.jpg";
import photo2 from "@/assets/photo-2.jpg";
import photo3 from "@/assets/photo-3.jpg";
import photo4 from "@/assets/photo-4.jpg";
import photo5 from "@/assets/photo-5.jpg";
import photo6 from "@/assets/photo-6.jpg";
import photo7 from "@/assets/photo-7.jpg";
import photo8 from "@/assets/photo-8.jpg";
import photo9 from "@/assets/photo-9.jpg";
import photo10 from "@/assets/photo-10.jpg";
import photo11 from "@/assets/photo-11.jpg";
import photo13 from "@/assets/photo-13.jpg";

const photos = [
  { id: 1, url: photo1, title: "暮色苍山", params: "f/8.0 · 1/120s · ISO 100", category: "Landscape" },
  { id: 2, url: photo2, title: "欧式校园", params: "f/5.6 · 1/500s · ISO 50", category: "Architecture" },
  { id: 3, url: photo3, title: "湖畔黑天鹅", params: "f/4.0 · 1/250s · ISO 100", category: "Nature" },
  { id: 4, url: photo4, title: "大礼堂广场", params: "f/5.6 · 1/200s · ISO 100", category: "City" },
  { id: 5, url: photo5, title: "永子棋院", params: "f/2.2 · 1/1000s · ISO 50", category: "Culture" },
  { id: 6, url: photo6, title: "热带椰林", params: "f/1.8 · 1/2000s · ISO 50", category: "Travel" },
  { id: 7, url: photo7, title: "麦田守望", params: "f/2.0 · 1/500s · ISO 100", category: "Portrait" },
  { id: 8, url: photo8, title: "通天之门", params: "f/2.8 · 1/1000s · ISO 50", category: "Minimalism" },
  { id: 9, url: photo9, title: "雪做的玫瑰", params: "f/1.8 · 1/60s · ISO 400", category: "Macro" },
  { id: 10, url: photo10, title: "海边路灯", params: "f/4.0 · 1/500s · ISO 50", category: "Minimalism" },
  { id: 11, url: photo11, title: "湖滨远眺", params: "f/8.0 · 1/250s · ISO 100", category: "City" },
  { id: 13, url: photo13, title: "雪山飞驰", params: "GoPro · 4K · 60fps", category: "Sports" },
];

// Get all unique categories
const categories = ["全部", ...Array.from(new Set(photos.map(p => p.category)))];

const Photography = () => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState("全部");

  const filteredPhotos = activeCategory === "全部"
    ? photos
    : photos.filter(p => p.category === activeCategory);

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);

  const goPrev = useCallback(() => {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex - 1 + filteredPhotos.length) % filteredPhotos.length);
  }, [lightboxIndex, filteredPhotos.length]);

  const goNext = useCallback(() => {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex + 1) % filteredPhotos.length);
  }, [lightboxIndex, filteredPhotos.length]);

  // Keyboard navigation
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

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    document.body.style.overflow = lightboxIndex !== null ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [lightboxIndex]);

  const currentPhoto = lightboxIndex !== null ? filteredPhotos[lightboxIndex] : null;

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
      
      <main className="relative z-10 container mx-auto px-8 pt-32 pb-24">
        <a 
          href="/#about"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-12 py-2 px-4 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4" />
          返回首页
        </a>

        <header className="mb-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="font-serif text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-amber-100 via-orange-50 to-amber-100 bg-clip-text text-transparent">
              光影瞬间
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed">
              用镜头捕捉世界的切片，定格那些稍纵即逝的美好。
            </p>
          </motion.div>
        </header>

        {/* Category Filter */}
        <motion.div
          className="flex flex-wrap gap-2 mb-10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-mono transition-all duration-200 border ${
                activeCategory === cat
                  ? "bg-orange-500/20 border-orange-500/50 text-orange-300"
                  : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
          <span className="ml-auto text-xs font-mono text-muted-foreground/50 self-center">
            {filteredPhotos.length} 张
          </span>
        </motion.div>

        <div className="columns-1 md:columns-2 lg:columns-3 gap-8 space-y-8">
          {filteredPhotos.map((photo, index) => (
            <motion.div
              key={photo.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="relative group break-inside-avoid cursor-pointer"
              onClick={() => openLightbox(index)}
            >
              <div className="relative overflow-hidden rounded-2xl bg-white/5 border border-white/10 transition-all duration-500 group-hover:border-orange-500/30 group-hover:shadow-[0_0_40px_rgba(249,115,22,0.1)]">
                <img 
                  src={photo.url} 
                  alt={photo.title}
                  className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-110"
                />
                
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                  <span className="inline-block px-3 py-1 rounded-full bg-orange-500/20 text-orange-300 text-xs font-mono mb-3 border border-orange-500/20 w-fit">
                    {photo.category}
                  </span>
                  <h3 className="text-white text-xl font-medium mb-2">{photo.title}</h3>
                  <div className="flex items-center justify-between text-white/60">
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <Aperture className="w-3 h-3" />
                      {photo.params}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-orange-300/80">
                      <ZoomIn className="w-4 h-4" />
                      <span>查看</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

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
            {/* Close button */}
            <button
              className="absolute top-6 right-6 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              onClick={closeLightbox}
            >
              <X className="w-6 h-6" />
            </button>

            {/* Counter */}
            <div className="absolute top-6 left-6 z-10 font-mono text-sm text-white/50">
              {lightboxIndex + 1} / {filteredPhotos.length}
            </div>

            {/* Prev button */}
            <button
              className="absolute left-4 md:left-8 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* Image */}
            <motion.div
              key={currentPhoto.id}
              className="relative max-w-5xl max-h-[85vh] mx-16 flex flex-col items-center"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={currentPhoto.url}
                alt={currentPhoto.title}
                className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl"
              />
              {/* Caption */}
              <div className="mt-4 text-center">
                <span className="inline-block px-3 py-1 rounded-full bg-orange-500/20 text-orange-300 text-xs font-mono mb-2 border border-orange-500/20">
                  {currentPhoto.category}
                </span>
                <h3 className="text-white text-lg font-medium mb-1">{currentPhoto.title}</h3>
                <div className="flex items-center justify-center gap-2 text-white/40 text-xs font-mono">
                  <Aperture className="w-3 h-3" />
                  {currentPhoto.params}
                </div>
              </div>
            </motion.div>

            {/* Next button */}
            <button
              className="absolute right-4 md:right-8 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); goNext(); }}
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            {/* Keyboard hint */}
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

export default Photography;
