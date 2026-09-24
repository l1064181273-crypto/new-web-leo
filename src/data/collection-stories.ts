import type { MediaItem } from "./media";

// These are editorial notes about the existing collection, not invented EXIF,
// travel histories, personal ratings, or additional journal entries.
export const photoStories: Record<string, { group: string; note: string }> = {
  "photo-1.jpg": { group: "山水与自然", note: "金色云层铺过山脊，近处的栏杆把人留在风景边上。" },
  "photo-2.jpg": { group: "建筑与街道", note: "浅色楼墙、蓝色拱窗，湖面把校园再映出一遍。" },
  "photo-3.jpg": { group: "山水与自然", note: "黑天鹅歇在岸边，楼宇的倒影铺满了湖面。" },
  "photo-4.jpg": { group: "建筑与街道", note: "绿瓦圆顶与广场上的人群，一静一动。" },
  "photo-5.jpg": { group: "建筑与街道", note: "从永子棋院的门楼望进去，花坛一路通向庭院里的楼阁。" },
  "photo-6.jpg": { group: "山水与自然", note: "椰树把影子铺在草地上，远山与蓝天留在树冠之间。" },
  "photo-7.jpg": { group: "人与细节", note: "白裙和整片麦田，展开的双臂与被风吹起的头发。" },
  "photo-8.jpg": { group: "建筑与街道", note: "对开的石门，把远处的一艘船框进窄窄的海面。" },
  "photo-9.jpg": { group: "人与细节", note: "路灯照亮一朵雪做的玫瑰，花瓣的边缘细碎而透亮。" },
  "photo-10.jpg": { group: "建筑与街道", note: "一根路灯、整片蓝色，脚下是堆叠的消波块。" },
  "photo-11.jpg": { group: "山水与自然", note: "湖上散着小船，楼群和远山排在对岸。" },
  "photo-13.jpg": { group: "人与细节", note: "两幅雪道拼在一起：一块单板的近景，和远处正在下滑的人。" },
};

export const journalStories: Record<string, { theme: string; text: string }> = {
  "daily-2.jpg": { theme: "在路上", text: "老君山，山顶的一碗泡面。" },
  "daily-3.jpg": { theme: "身边人", text: "妹妹弹古筝的片刻，留在生活的声音里。" },
  "daily-4.jpg": { theme: "日常", text: "实验室的日常。记录研究之外的小瞬间。" },
  "daily-5.jpg": { theme: "在路上", text: "西岛两日，把步调交给海风。" },
  "daily-6.jpg": { theme: "身边人", text: "朋友送来的一本书。书页之外，还有心意。" },
  "daily-7.jpg": { theme: "日常", text: "一次可爱的偶遇。" },
};

export const filmStories: Record<string, {
  en: string; director: string; minutes: number; year: number;
  line: string; note: string; tags: string[]; source: string;
}> = {
  "films/interstellar.jpg": { en: "Interstellar", director: "Christopher Nolan", minutes: 169, year: 2014, line: "穿越时间，寻找回家的方向。", note: "可以沿着两条线观看：宇宙尺度的旅程，以及亲人之间被时间拉开的距离。", tags: ["科幻", "宇宙", "亲情"], source: "https://en.wikipedia.org/wiki/Interstellar_(film)" },
  "films/shawshank.jpg": { en: "The Shawshank Redemption", director: "Frank Darabont", minutes: 142, year: 1994, line: "关于希望，也关于漫长的自由。", note: "留意叙述者的声音与人物的日常动作。自由这个大词，被放进了许多具体而细小的选择里。", tags: ["剧情", "希望", "友谊"], source: "https://en.wikipedia.org/wiki/The_Shawshank_Redemption" },
  "films/spirited-away.jpg": { en: "Spirited Away", director: "Hayao Miyazaki", minutes: 125, year: 2001, line: "在陌生的世界里，记得自己的名字。", note: "除了奇幻场景，也可以观察食物、劳动和名字如何参与讲述一个成长故事。", tags: ["动画", "成长", "奇幻"], source: "https://en.wikipedia.org/wiki/Spirited_Away" },
  "films/inception.jpg": { en: "Inception", director: "Christopher Nolan", minutes: 148, year: 2010, line: "一个念头，能抵达多深的梦境？", note: "空间折叠与时间层级共同组织了这部电影。留意声音如何把不同层的行动连接起来。", tags: ["科幻", "悬疑", "梦境"], source: "https://en.wikipedia.org/wiki/Inception" },
  "films/forrest-gump.jpg": { en: "Forrest Gump", director: "Robert Zemeckis", minutes: 142, year: 1994, line: "向前奔跑，看生活慢慢展开。", note: "个人的讲述与更大的时代背景交替出现。可以留意反复出现的物件与动作，它们如何串起时间。", tags: ["剧情", "人生", "成长"], source: "https://en.wikipedia.org/wiki/Forrest_Gump" },
  "films/the-matrix.jpg": { en: "The Matrix", director: "The Wachowskis", minutes: 136, year: 1999, line: "真实世界，也许从一个问题开始。", note: "色彩、服装和空间共同建立了两个世界。动作之外，关于感知与选择的问题一直存在。", tags: ["科幻", "动作", "哲学"], source: "https://en.wikipedia.org/wiki/The_Matrix" },
};

export const foodStories: Record<string, { group: string; flavors: string[]; note: string; detail: string }> = {
  "food/sichuan-hotpot.jpg": { group: "热闹的一桌", flavors: ["麻", "辣", "鲜香"], note: "翻滚的红汤，是这一桌最鲜明的颜色。", detail: "花椒的麻、辣椒的辣，再加一碟自己的蘸料。" },
  "food/cantonese-dimsum.jpg": { group: "慢慢吃", flavors: ["清鲜", "蒸点", "早茶"], note: "一盅两件，把一餐的节奏放慢。", detail: "茶、蒸笼与不同口感的小点，一次不必只选一种。" },
  "food/japanese-sushi.jpg": { group: "海的味道", flavors: ["鲜甜", "米香", "海味"], note: "米饭与食材，刚好放进一小口。", detail: "醋饭的微酸、食材的鲜味和整齐的切面。" },
  "food/bbq-grilled-meat.jpg": { group: "热闹的一桌", flavors: ["炭香", "焦边", "烟火"], note: "烤肉的焦边，是炭火留下的痕迹。", detail: "表面的焦香、油脂的变化，以及不同食材的质地。" },
  "food/italian-pasta.jpg": { group: "慢慢吃", flavors: ["麦香", "酱汁", "浓郁"], note: "一盘面，和裹在面上的酱汁。", detail: "面条的形状影响着酱汁的附着，也改变每一口的口感。" },
  "food/yunnan-mushroom.webp": { group: "山野风味", flavors: ["山野", "鲜香", "时令"], note: "菌子的形状与香气，带来山野的味道。", detail: "不同的菌子，也有不同的质地与烹调方式。" },
  "food/chengdu-skewers.jpg": { group: "热闹的一桌", flavors: ["麻辣", "小食", "锅气"], note: "一串一个选择，慢慢凑成一桌。", detail: "锅底的香气与不同食材的口感，构成串串的变化。" },
  "food/tokyo-sushi-omakase.jpg": { group: "海的味道", flavors: ["时令", "海味", "节奏"], note: "一道接着一道，菜单交给厨师安排。", detail: "Omakase 是一种用餐方式，并非一道固定菜名。" },
  "food/beijing-duck.jpg": { group: "热闹的一桌", flavors: ["酥脆", "酱香", "层次"], note: "烤鸭、薄饼与配料，让一口有了不同层次。", detail: "鸭皮的酥、薄饼的柔，以及葱与酱的组合。" },
  "food/sanya-seafood.jpg": { group: "海的味道", flavors: ["鲜甜", "海味", "清鲜"], note: "鱼、虾、贝，把海味摆成一桌。", detail: "不同海鲜的纹理和口感，适合放在一起比较。" },
};

export const collectionIntroductions = {
  daily: "六个生活片刻。按月份翻阅，在山顶、实验室、海边和身边人之间慢慢走。",
  photos: "山脊、街道、麦田和雪。十二张照片，按主题翻看。",
  artists: "收藏的声音与面孔。这里是歌手图像档案；歌曲试听在桌面的 Music 里。",
  films: "六部电影组成的小片架。按类型挑选，也可以加入待看清单。",
  games: "四个不同的游戏世界。从神话、荒野到夜之城，封面也是想象力的入口。",
  food: "十种风味留在同一张桌上。按口味浏览，也可以存下自己的想吃清单。",
} as const;

export function storyFor(item: MediaItem) {
  return photoStories[item.id]?.note ?? journalStories[item.id]?.text ?? filmStories[item.id]?.note ?? foodStories[item.id]?.note ?? collectionIntroductions[item.category];
}

export function nextCollectionId(items: Pick<MediaItem, "id">[], currentId: string, offset: number) {
  if (!items.length) return null;
  const current = items.findIndex(item => item.id === currentId);
  const origin = current < 0 ? 0 : current;
  return items[((origin + offset) % items.length + items.length) % items.length].id;
}

export function playbackTime(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}
