import { writeFile, mkdir } from "node:fs/promises";
const entries = [
  ["Lose Control", "Teddy Swims"],
  ["A Bar Song (Tipsy)", "Shaboozey"],
  ["Beautiful Things", "Benson Boone"],
  ["I Had Some Help", "Post Malone"],
  ["Lovin On Me", "Jack Harlow"],
  ["Not Like Us", "Kendrick Lamar"],
  ["Espresso", "Sabrina Carpenter"],
  ["MILLION DOLLAR BABY", "Tommy Richman"],
  ["I Remember Everything", "Zach Bryan"],
  ["Too Sweet", "Hozier"],
];
const chart = {
  title: "Billboard Year-End Hot 100 · 2024",
  url: "https://www.billboard.com/lists/hot-100-year-end-chart-teddy-swims-taylor-swift-republic/2024-hot-100-songs-top-10/",
  published: "2024-12-13",
  verified: "2026-09-10",
};
await mkdir("artifacts/sandbox-v3/music", { recursive: true });
const tracks = [];
for (const [index, [title, artist]] of entries.entries()) {
  const url = new URL("https://itunes.apple.com/search");
  url.search = new URLSearchParams({ term: `${artist} ${title}`, entity: "song", country: "us", limit: "15" }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  await writeFile(`artifacts/sandbox-v3/music/${index + 1}.json`, JSON.stringify(data, null, 2));
  const track = data.results?.find(t => t.artistName.toLowerCase().includes(artist.toLowerCase()) && t.trackName.toLowerCase().startsWith(title.toLowerCase()) && !/live|remix|instrumental|acoustic|version|sped|slowed/i.test(t.trackName) && t.previewUrl);
  if (!track) throw new Error(`Official preview not found for ${title}`);
  tracks.push({ rank: index + 1, title, artist: track.artistName, previewUrl: track.previewUrl, url: track.trackViewUrl, trackId: track.trackId, explicit: track.trackExplicitness === "explicit" });
  console.log(index + 1, track.trackId, track.trackName, track.artistName);
}
await writeFile("src/data/chart-music.json", JSON.stringify({ chart, tracks }, null, 2) + "\n");
