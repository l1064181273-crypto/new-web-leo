import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import ParticleBackground from "@/components/ParticleBackground";

// Import all photos
const dailyPhotos = [
  { img: "/src/assets/daily-2.jpg", time: "2025年12月", location: "Mountain", title: "老君山上吃泡面 🍝" },
  { img: "/src/assets/daily-3.jpg", time: "2026年1月", location: "Music", title: "妹妹弹古筝给我听 🎶" },
  { img: "/src/assets/daily-4.jpg", time: "2026年1月", location: "Lab", title: "深夜的实验室 🧪" },
  { img: "/src/assets/daily-5.jpg", time: "2026年2月", location: "Travel", title: "西岛两日游 🥽" },
  { img: "/src/assets/daily-6.jpg", time: "2026年2月", location: "Reading", title: "朋友赠书 📚" },
  { img: "/src/assets/daily-7.jpg", time: "2026年3月", location: "Pet", title: "可爱的小狗 🐕" },
];

const photographyPhotos = [
  { img: "/src/assets/photo-1.jpg", time: "2025年10月", location: "Landscape", title: "暮色苍山" },
  { img: "/src/assets/photo-2.jpg", time: "2025年10月", location: "Architecture", title: "欧式校园" },
  { img: "/src/assets/photo-3.jpg", time: "2025年11月", location: "Nature", title: "湖畔黑天鹅" },
  { img: "/src/assets/photo-4.jpg", time: "2025年11月", location: "City", title: "大礼堂广场" },
  { img: "/src/assets/photo-5.jpg", time: "2025年12月", location: "Culture", title: "永子棋院" },
  { img: "/src/assets/photo-6.jpg", time: "2025年12月", location: "Travel", title: "热带椰林" },
  { img: "/src/assets/photo-7.jpg", time: "2026年1月", location: "Portrait", title: "麦田守望" },
  { img: "/src/assets/photo-8.jpg", time: "2026年1月", location: "Minimalism", title: "通天之门" },
  { img: "/src/assets/photo-9.jpg", time: "2026年2月", location: "Macro", title: "雪做的玫瑰" },
  { img: "/src/assets/photo-10.jpg", time: "2026年2月", location: "Minimalism", title: "海边路灯" },
  { img: "/src/assets/photo-11.jpg", time: "2026年3月", location: "City", title: "湖滨远眺" },
  { img: "/src/assets/photo-13.jpg", time: "2026年3月", location: "Sports", title: "雪山飞驰" },
];

const allPhotos = [...dailyPhotos, ...photographyPhotos];

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: "easeOut" } },
};

const Photos = () => {
  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      <ParticleBackground />
      <Navbar />
      <motion.main
        className="relative z-10 pt-24 pb-16 px-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <div className="container mx-auto max-w-7xl">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="font-serif text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-amber-100 via-orange-50 to-amber-100 bg-clip-text text-transparent">
              照片墙
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
              汇聚生活点滴与光影瞬间，记录每一个值得珍藏的时刻。
            </p>
          </motion.div>

          <motion.div
            className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6"
            variants={container}
            initial="hidden"
            animate="visible"
          >
            {allPhotos.map((p, i) => (
              <motion.div
                key={i}
                className="relative group break-inside-avoid rounded-2xl overflow-hidden bg-white/5 border border-white/10 shadow-lg hover:shadow-orange-500/20 transition-all duration-300"
                variants={item}
              >
                <img
                  src={p.img}
                  alt={p.title}
                  className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-110"
                  loading="lazy"
                />
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                  <span className="inline-block px-2 py-1 rounded bg-orange-500/20 text-orange-300 text-[10px] font-mono mb-2 border border-orange-500/20 w-fit">
                    {p.location}
                  </span>
                  <h3 className="font-heading text-lg font-medium text-white mb-1">{p.title}</h3>
                  <p className="font-mono text-xs text-white/60">
                    {p.time}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <footer className="border-t border-white/5 py-8 px-8 text-center mt-24">
          <p className="font-mono text-xs text-muted-foreground">
            © 2026 Leo_homepage · All memories reserved.
          </p>
        </footer>
      </motion.main>
    </div>
  );
};

export default Photos;
