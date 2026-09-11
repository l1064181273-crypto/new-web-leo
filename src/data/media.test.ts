import { describe, expect, it } from "vitest";
import { collectionInfo, filterMedia, media, type CollectionId } from "./media";

describe("original photo migration", () => {
  it("includes every collection image exactly once", () => {
    expect(media).toHaveLength(47);
    expect(new Set(media.map((item) => item.id)).size).toBe(47);
    expect(
      Object.keys(collectionInfo).map(
        (id) => filterMedia(id as CollectionId).length,
      ),
    ).toEqual([7, 13, 7, 6, 4, 10]);
    for (const item of media) expect(item.image).toBeTruthy();
  });
  it("searches multilingual titles and collection names", () => {
    expect(filterMedia("photos", "苍山")[0].id).toBe("photo-1.jpg");
    expect(filterMedia("artists", "  TAYLOR  ")[0].title).toBe("Taylor Swift");
    expect(filterMedia("all", "no-such-item")).toHaveLength(0);
  });
  it("filters favorites by stable asset identities", () => {
    const favorites = ["photo-1.jpg", "nonexistent"];
    expect(
      filterMedia("favorites", "", favorites).map((item) => item.id),
    ).toEqual(["photo-1.jpg"]);
  });
});
