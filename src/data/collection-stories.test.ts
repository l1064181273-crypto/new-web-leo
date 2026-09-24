import { describe, expect, it } from "vitest";
import { filterMedia } from "./media";
import { filmStories, foodStories, journalStories, nextCollectionId, photoStories, playbackTime } from "./collection-stories";
import music from "./chart-music.json";

describe("collection content integrity", () => {
  it("attaches every note to an existing stable image identity", () => {
    for (const [category, stories] of [["photos", photoStories], ["daily", journalStories], ["films", filmStories], ["food", foodStories]] as const) {
      expect(Object.keys(stories).sort()).toEqual(filterMedia(category).map(item => item.id).sort());
    }
  });
  it("keeps film references and factual metadata available after filtering", () => {
    const films = filterMedia("films").filter(item => filmStories[item.id].tags.includes("剧情"));
    expect(filmStories[films[0].id].director).toBe("Frank Darabont");
    for (const detail of Object.values(filmStories)) {
      expect(new URL(detail.source).hostname).toBe("en.wikipedia.org");
      expect(new URL(detail.source).protocol).toBe("https:");
      expect(detail.minutes).toBeGreaterThan(100);
    }
  });
  it("keeps the checked-in music catalog on official HTTPS sources", () => {
    expect(new URL(music.chart.url).origin).toBe("https://www.billboard.com");
    for (const track of music.tracks) {
      expect(new URL(track.url).origin).toBe("https://music.apple.com");
      expect(new URL(track.previewUrl).origin).toBe("https://audio-ssl.itunes.apple.com");
    }
  });
  it("wraps navigation in both directions and handles an empty view", () => {
    const items = filterMedia("photos").slice(0, 3);
    expect(nextCollectionId(items, items[0].id, -1)).toBe(items[2].id);
    expect(nextCollectionId(items, items[2].id, 1)).toBe(items[0].id);
    expect(nextCollectionId([], "missing", 1)).toBeNull();
  });
  it("never renders invalid media durations", () => {
    expect(playbackTime(90.8)).toBe("1:30");
    expect(playbackTime(Infinity)).toBe("0:00");
    expect(playbackTime(NaN)).toBe("0:00");
    expect(playbackTime(-3)).toBe("0:00");
  });
});
