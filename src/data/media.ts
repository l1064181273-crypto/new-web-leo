const assets = import.meta.glob<string>(
  ["/src/assets/daily-*.jpg", "/src/assets/photo-*.jpg", "/src/assets/artists/*.{jpg,png}", "/src/assets/films/*.jpg", "/src/assets/food/*.{jpg,webp}", "/src/assets/game-*.jpg"],
  { eager: true, import: "default" },
);

export type CollectionId =
  | "daily"
  | "photos"
  | "artists"
  | "films"
  | "games"
  | "food";
export type MediaItem = {
  id: string;
  image: string;
  file: string;
  title: string;
  subtitle: string;
  category: CollectionId;
};
export const collectionInfo: Record<
  CollectionId,
  { name: string; en: string; description: string }
> = {
  daily: {
    name: "日常点滴",
    en: "Daybook",
    description: "朋友、旅行、实验室。把普通日子好好收藏。",
  },
  photos: {
    name: "光影瞬间",
    en: "Photography",
    description: "在光线与风景之间，记录自己的观看方式。",
  },
  artists: {
    name: "音乐收藏",
    en: "Sound Archive",
    description: "那些陪伴过生活的声音。",
  },
  films: {
    name: "电影收藏",
    en: "Cinema",
    description: "关于时间、成长，以及不止一种人生。",
  },
  games: {
    name: "游戏收藏",
    en: "Game Shelf",
    description: "走进另一个世界，带回一些灵感。",
  },
  food: {
    name: "舌尖记忆",
    en: "Table Stories",
    description: "用一餐饭，记住一座城。",
  },
};

const entries: [CollectionId, string, string, string][] = [
  ["daily", "daily-2.jpg", "山顶的一碗泡面", "老君山 · 2025.12"],
  ["daily", "daily-3.jpg", "弦上片刻", "妹妹的古筝 · 2026.01"],
  ["daily", "daily-4.jpg", "深夜实验室", "研究生日常 · 2026.01"],
  ["daily", "daily-5.jpg", "西岛两日", "海边 · 2026.02"],
  ["daily", "daily-6.jpg", "朋友赠书", "阅读 · 2026.02"],
  ["daily", "daily-7.jpg", "偶遇小狗", "生活片刻 · 2026.03"],
  ["photos", "photo-1.jpg", "暮色苍山", "Landscape"],
  ["photos", "photo-2.jpg", "欧式校园", "Architecture"],
  ["photos", "photo-3.jpg", "湖畔黑天鹅", "Nature"],
  ["photos", "photo-4.jpg", "大礼堂广场", "City"],
  ["photos", "photo-5.jpg", "永子棋院", "Culture"],
  ["photos", "photo-6.jpg", "热带椰林", "Travel"],
  ["photos", "photo-7.jpg", "麦田守望", "Portrait"],
  ["photos", "photo-8.jpg", "通天之门", "Minimalism"],
  ["photos", "photo-9.jpg", "雪做的玫瑰", "Macro"],
  ["photos", "photo-10.jpg", "海边路灯", "Minimalism"],
  ["photos", "photo-11.jpg", "湖滨远眺", "City"],
  ["photos", "photo-13.jpg", "雪山飞驰", "Sports"],
  ["artists", "artists/jay-chou.jpg", "周杰伦", "华语流行 / R&B"],
  ["artists", "artists/eason-chan.jpg", "陈奕迅", "粤语 / 华语流行"],
  ["artists", "artists/taylor-swift.png", "Taylor Swift", "Pop / Country"],
  ["artists", "artists/linkin-park.jpg", "Linkin Park", "Rock / Alternative"],
  ["artists", "artists/wang-leehom.jpg", "王力宏", "华语流行 / R&B"],
  ["artists", "artists/charlie-puth.jpg", "Charlie Puth", "Pop / R&B"],
  ["artists", "artists/li-jian.jpg", "李健", "民谣 / 华语流行"],
  ["films", "films/interstellar.jpg", "星际穿越", "2014 · 科幻"],
  ["films", "films/shawshank.jpg", "肖申克的救赎", "1994 · 剧情"],
  ["films", "films/spirited-away.jpg", "千与千寻", "2001 · 动画"],
  ["films", "films/inception.jpg", "盗梦空间", "2010 · 科幻"],
  ["films", "films/forrest-gump.jpg", "阿甘正传", "1994 · 剧情"],
  ["films", "films/the-matrix.jpg", "黑客帝国", "1999 · 科幻"],
  ["games", "game-wukong.jpg", "黑神话：悟空", "动作角色扮演"],
  ["games", "game-eldenring.jpg", "艾尔登法环", "开放世界"],
  ["games", "game-cyberpunk.jpg", "Cyberpunk 2077", "夜之城"],
  ["games", "game-crossfire.jpg", "穿越火线", "经典竞技"],
  ["food", "food/sichuan-hotpot.jpg", "川味火锅", "麻辣 · 川菜"],
  ["food", "food/cantonese-dimsum.jpg", "广式早茶", "一盅两件 · 粤菜"],
  ["food", "food/japanese-sushi.jpg", "日式寿司", "日料"],
  ["food", "food/bbq-grilled-meat.jpg", "炭火烧烤", "烟火气"],
  ["food", "food/italian-pasta.jpg", "意大利面", "意式料理"],
  ["food", "food/yunnan-mushroom.webp", "云南野生菌", "山野风味"],
  ["food", "food/chengdu-skewers.jpg", "成都串串", "成都"],
  ["food", "food/tokyo-sushi-omakase.jpg", "Omakase", "东京"],
  ["food", "food/beijing-duck.jpg", "北京烤鸭", "北京"],
  ["food", "food/sanya-seafood.jpg", "三亚海鲜", "三亚"],
];

export const media: MediaItem[] = entries.map(
  ([category, file, title, subtitle]) => {
    const image = assets[`/src/assets/${file}`];
    if (!image) throw new Error(`Missing media: ${file}`);
    return { id: file, image, file, title, subtitle, category };
  },
);

export function filterMedia(
  category: CollectionId | "all" | "favorites",
  query = "",
  favorites: string[] = [],
) {
  const search = query.trim().toLocaleLowerCase();
  return media.filter(
    (item) =>
      (category === "all" ||
        (category === "favorites"
          ? favorites.includes(item.id)
          : item.category === category)) &&
      `${item.title} ${item.subtitle} ${collectionInfo[item.category].en}`
        .toLocaleLowerCase()
        .includes(search),
  );
}
