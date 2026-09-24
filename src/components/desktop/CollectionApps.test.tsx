import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { z } from "zod";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CinemaApp, DaybookApp, PhotographyApp, TableStoriesApp } from "./CollectionApps";
import GalleryApp from "./GalleryApp";
import { CollectionThumbnail } from "./CollectionThumbnail";
import { filterMedia } from "@/data/media";
import * as mediaSource from "@/data/media";
import { useLocalState } from "@/hooks/use-local-state";

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function SavedPhotos({ atlas = false, count = 1 }: { atlas?: boolean; count?: number }) {
  const [favorites, setFavorites] = useState(filterMedia("photos").slice(0, count).map(item => item.id));
  const toggleFavorite = (id: string) => setFavorites(old => old.includes(id) ? old.filter(value => value !== id) : [...old, id]);
  return atlas ? <GalleryApp initial="favorites" favorites={favorites} toggleFavorite={toggleFavorite} /> : <PhotographyApp favorites={favorites} toggleFavorite={toggleFavorite} />;
}

const savedCollectionCases = [
  { name: "Cinema", render: () => { localStorage.setItem("leo-cinema-watchlist-v1", JSON.stringify([filterMedia("films")[0].id])); render(<CinemaApp />); }, filter: /待看清单 1/, remove: "从待看清单移除", empty: "查看全部" },
  { name: "Daybook", render: () => { localStorage.setItem("leo-daybook-bookmarks-v2", JSON.stringify([filterMedia("daily")[0].id])); render(<DaybookApp />); }, filter: "书签", remove: "移除日记书签", empty: "查看全部" },
  { name: "Table", render: () => { localStorage.setItem("leo-tasting-list-v1", JSON.stringify([filterMedia("food")[0].id])); render(<TableStoriesApp />); }, filter: /想吃清单 1/, remove: "从想吃清单移除", empty: "查看全部" },
  { name: "Photography", render: () => { render(<SavedPhotos />); }, filter: /已收藏/, remove: "取消收藏照片", empty: "查看全部" },
  { name: "Atlas", render: () => { render(<SavedPhotos atlas />); }, filter: /我的收藏/, remove: `取消收藏 ${filterMedia("photos")[0].title}`, empty: "浏览所有收藏" },
];

describe("collection removal focus", () => {
  it.each(savedCollectionCases)("moves $name focus to its empty-state action only when the focused removal control disappears", ({ render: show, filter, remove, empty }) => {
    show();
    fireEvent.click(screen.getByRole("button", { name: filter }));
    const control = screen.getByRole("button", { name: remove });
    control.focus();
    fireEvent.click(control);
    expect(control).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: empty })).toHaveFocus();
  });

  it.each(savedCollectionCases)("does not steal $name focus after a nonfocused removal", ({ render: show, filter, remove, empty }) => {
    show();
    const currentFilter = screen.getByRole("button", { name: filter });
    fireEvent.click(currentFilter);
    currentFilter.focus();
    fireEvent.click(screen.getByRole("button", { name: remove }));
    expect(screen.getByRole("button", { name: empty })).not.toHaveFocus();
    expect(currentFilter).toHaveFocus();
  });

  it.each(savedCollectionCases)("keeps $name keyboard navigation inside the collection after using the empty-state action", ({ render: show, filter, remove, empty }) => {
    show();
    fireEvent.click(screen.getByRole("button", { name: filter }));
    const control = screen.getByRole("button", { name: remove });
    control.focus();
    fireEvent.click(control);
    const reset = screen.getByRole("button", { name: empty });
    fireEvent.click(reset);
    expect(reset).not.toBeInTheDocument();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement?.tagName).toBe("BUTTON");
    expect(document.activeElement?.isConnected).toBe(true);
  });

  it("keeps focus on an existing photography heart after removing one of several favorites", () => {
    const photos = filterMedia("photos").slice(0, 2);
    const toggle = vi.fn();
    const view = render(<PhotographyApp favorites={photos.map(item => item.id)} toggleFavorite={toggle} />);
    fireEvent.click(screen.getByRole("button", { name: /已收藏/ }));
    const control = screen.getByRole("button", { name: "取消收藏照片" });
    control.focus();
    fireEvent.click(control);
    view.rerender(<PhotographyApp favorites={[photos[1].id]} toggleFavorite={toggle} />);
    expect(control).toHaveFocus();
    expect(screen.getByRole("heading", { name: photos[1].title })).toBeInTheDocument();
  });

  it("does not move focus when shared favorites update from another app", () => {
    const photo = filterMedia("photos")[0];
    const toggle = vi.fn();
    const view = render(<PhotographyApp favorites={[photo.id]} toggleFavorite={toggle} />);
    const filter = screen.getByRole("button", { name: /已收藏/ });
    fireEvent.click(filter);
    filter.focus();
    view.rerender(<PhotographyApp favorites={[]} toggleFavorite={toggle} />);
    expect(filter).toHaveFocus();
    expect(screen.getByRole("button", { name: "查看全部" })).not.toHaveFocus();
  });

  it.each([false, true])("keeps the open image context and restores focus after its last favorite is removed (atlas=%s)", async atlas => {
    const photo = filterMedia("photos")[0];
    render(<SavedPhotos atlas={atlas} />);
    if (!atlas) fireEvent.click(screen.getByRole("button", { name: /已收藏/ }));
    const trigger = screen.getByRole("button", { name: `${atlas ? "查看" : "放大"} ${photo.title}` });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog");
    const favorite = within(dialog).getByRole("button", { name: "取消收藏当前图片" });
    favorite.focus();
    fireEvent.click(favorite);
    expect(within(dialog).getByRole("heading", { name: photo.title })).toBeInTheDocument();
    expect(within(dialog).getByText(/· 1 \/ 1$/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "收藏当前图片" })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: atlas ? "浏览所有收藏" : "查看全部" })).toHaveFocus());
  });

  it.each([false, true])("keeps viewer navigation in its opening list while favorites change (atlas=%s)", atlas => {
    const photos = filterMedia("photos").slice(0, 2);
    render(<SavedPhotos atlas={atlas} count={2} />);
    if (!atlas) fireEvent.click(screen.getByRole("button", { name: /已收藏/ }));
    fireEvent.click(screen.getByRole("button", { name: `${atlas ? "查看" : "放大"} ${photos[0].title}` }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "取消收藏当前图片" }));
    expect(within(dialog).getByText(/· 1 \/ 2$/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "下一张" }));
    expect(within(dialog).getByRole("heading", { name: photos[1].title })).toBeInTheDocument();
    expect(within(dialog).getByText(/· 2 \/ 2$/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "上一张" }));
    expect(within(dialog).getByRole("heading", { name: photos[0].title })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "收藏当前图片" })).toHaveAttribute("aria-pressed", "false");
  });
});

describe("shared desktop favorites contract", () => {
  it.each(["photography", "atlas"])("keeps shared %s recovery instructions visible inside its viewer and requires a page reload", app => {
    const recovery = { recoveryRaw: null, recoveryKey: null, readFailed: false, conflict: true };
    const props = { favorites: [], toggleFavorite: vi.fn(), favoritesSaved: false, favoritesRecovery: recovery };
    render(app === "atlas" ? <GalleryApp initial="photos" {...props} /> : <PhotographyApp {...props} />);
    expect(screen.getByRole("status")).toHaveTextContent("先导出未保存的便签或记下当前选择，再刷新整个桌面");
    expect(screen.getByRole("status")).not.toHaveTextContent("重新打开此应用");
    const photo = filterMedia("photos")[0];
    fireEvent.click(screen.getByRole("button", { name: `${app === "atlas" ? "查看" : "放大"} ${photo.title}` }));
    expect(within(screen.getByRole("dialog")).getByRole("status")).toHaveTextContent("刷新整个桌面");
  });

  it("explains that a shared favorites read failure also needs the desktop to reopen, not just the gallery", () => {
    render(<GalleryApp initial="photos" favorites={[]} toggleFavorite={vi.fn()} favoritesSaved={false} favoritesRecovery={{ recoveryRaw: null, recoveryKey: null, readFailed: true, conflict: false }} />);
    expect(screen.getByRole("status")).toHaveTextContent("无法读取");
    expect(screen.getByRole("status")).toHaveTextContent("先导出未保存的便签或记下当前选择，再刷新整个桌面");
  });

  it("keeps photography and Atlas in sync when their desktop owner shares one persisted state", () => {
    function Windows() {
      const [favorites, setFavorites] = useLocalState<string[]>("leo-desktop-favorites-v1", [], z.array(z.string()).max(1000));
      const toggleFavorite = (id: string) => setFavorites(old => old.includes(id) ? old.filter(value => value !== id) : [...old, id]);
      return <><PhotographyApp favorites={favorites} toggleFavorite={toggleFavorite} /><section aria-label="Atlas 测试窗口"><GalleryApp initial="favorites" favorites={favorites} toggleFavorite={toggleFavorite} /></section></>;
    }
    const photos = filterMedia("photos").slice(0, 2);
    render(<Windows />);
    const photography = within(screen.getByRole("region", { name: "摄影作品集" }));
    const atlas = within(screen.getByRole("region", { name: "Atlas 测试窗口" }));
    fireEvent.click(photography.getByRole("button", { name: "收藏照片" }));
    expect(atlas.getByRole("button", { name: `查看 ${photos[0].title}` })).toBeInTheDocument();
    fireEvent.click(photography.getByRole("button", { name: "下一张作品" }));
    fireEvent.click(photography.getByRole("button", { name: "收藏照片" }));
    fireEvent.click(atlas.getByRole("button", { name: `取消收藏 ${photos[0].title}` }));
    expect(photography.getByRole("button", { name: "取消收藏照片" })).toBeInTheDocument();
    expect(atlas.queryByRole("button", { name: `查看 ${photos[0].title}` })).not.toBeInTheDocument();
    expect(atlas.getByRole("button", { name: `查看 ${photos[1].title}` })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("leo-desktop-favorites-v1")!)).toEqual([photos[1].id]);
  });
});

describe("collection browsing", () => {
  it("keeps photography navigation inside the selected theme", () => {
    render(<PhotographyApp favorites={[]} toggleFavorite={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "人与细节" }));
    expect(screen.getByRole("heading", { name: "麦田守望" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "上一张作品" }));
    expect(screen.getByRole("heading", { name: "雪山飞驰" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /已收藏/ }));
    expect(screen.getByRole("heading", { name: "还没有收藏的照片" })).toBeInTheDocument();
  });
  it("swipes photographs without accidentally opening the viewer", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1000);
    render(<PhotographyApp favorites={[]} toggleFavorite={vi.fn()} />);
    const figure = screen.getByRole("button", { name: "放大 暮色苍山" }).closest("figure")!;
    fireEvent.touchStart(figure, { touches: [{ clientX: 240, clientY: 160 }] });
    fireEvent.touchEnd(figure, { changedTouches: [{ clientX: 60, clientY: 166 }] });
    expect(screen.getByRole("heading", { name: "欧式校园" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "放大 欧式校园" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    now.mockReturnValue(1500);
    fireEvent.click(screen.getByRole("button", { name: "放大 欧式校园" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  it("allows the cinema watchlist to be viewed and emptied", () => {
    render(<CinemaApp />);
    fireEvent.click(screen.getByRole("button", { name: "剧情" }));
    expect(screen.getByText("Frank Darabont")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "加入待看清单" }));
    fireEvent.click(screen.getByRole("button", { name: /待看清单 1/ }));
    expect(within(screen.getByRole("navigation", { name: "选择影片" })).getAllByRole("button")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "从待看清单移除" }));
    expect(screen.getByRole("heading", { name: "这张片架还没有待看电影" })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("leo-cinema-watchlist-v1")!)).toEqual([]);
  });
  it("filters journal months without pairing the wrong memory with an image", () => {
    render(<DaybookApp />);
    fireEvent.change(screen.getByRole("combobox", { name: "日记月份" }), { target: { value: "2026.02" } });
    expect(screen.getByRole("heading", { name: "西岛两日" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "给日记加书签" }));
    fireEvent.click(screen.getByRole("button", { name: "书签" }));
    expect(within(screen.getByRole("navigation", { name: "日记条目" })).getAllByRole("button")).toHaveLength(1);
    expect(screen.getByText("西岛两日，把步调交给海风。")).toBeInTheDocument();
  });
  it.each([
    ["全部月份", "还没有符合筛选的书签"],
    ["2025.12", "这个月份还没有书签"],
  ])("labels an emptied bookmark filter accurately for %s", (month, message) => {
    render(<DaybookApp />);
    fireEvent.change(screen.getByRole("combobox", { name: "日记月份" }), { target: { value: month } });
    fireEvent.click(screen.getByRole("button", { name: "给日记加书签" }));
    fireEvent.click(screen.getByRole("button", { name: "书签" }));
    fireEvent.click(screen.getByRole("button", { name: "移除日记书签" }));
    expect(screen.getByRole("heading", { name: message })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "日记月份" })).toHaveValue(month);
    expect(within(screen.getByRole("navigation", { name: "日记条目" })).queryAllByRole("button")).toHaveLength(0);
  });
  it.each([
    ["全部月份", "还没有符合筛选的日记"],
    ["2025.12", "这个月份没有相关日记"],
  ])("labels an empty ordinary journal filter accurately for %s", (month, message) => {
    // A smaller collection can have no entries for a theme even across all months.
    vi.spyOn(mediaSource, "filterMedia").mockReturnValue(filterMedia("daily").slice(0, 1));
    render(<DaybookApp />);
    fireEvent.change(screen.getByRole("combobox", { name: "日记月份" }), { target: { value: month } });
    fireEvent.click(screen.getByRole("button", { name: "日常" }));
    expect(screen.getByRole("heading", { name: message })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "日记月份" })).toHaveValue(month);
  });
  it("shows saved dishes and gives feedback when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("unavailable"); });
    render(<TableStoriesApp />);
    fireEvent.change(screen.getByRole("combobox", { name: "风味分类" }), { target: { value: "海的味道" } });
    expect(screen.getByRole("heading", { name: "日式寿司" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "加入想吃清单" }));
    fireEvent.click(screen.getByRole("button", { name: /想吃清单 1/ }));
    expect(within(screen.getByRole("navigation", { name: "风味菜单" })).getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("暂时只保留在本次浏览中");
  });
  it("supports keyboard viewing and returns focus to the image trigger", async () => {
    const desktopEscape = vi.fn();
    render(<div onKeyDown={event => { if (event.key === "Escape") desktopEscape(); }}><GalleryApp initial="photos" favorites={[]} toggleFavorite={vi.fn()} /></div>);
    const trigger = screen.getByRole("button", { name: "查看 暮色苍山" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(within(dialog).getByRole("heading", { name: "欧式校园" })).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(desktopEscape).not.toHaveBeenCalled();
  });
  it("uses thumbnails in the grid while the viewer and download keep original files", () => {
    const item = filterMedia("photos")[0];
    render(<GalleryApp initial="photos" favorites={[]} toggleFavorite={vi.fn()} />);
    const thumbnail = within(screen.getByRole("button", { name: `查看 ${item.title}` })).getByRole("img");
    expect(thumbnail).toHaveAttribute("srcset", expect.stringContaining("160w"));
    fireEvent.click(screen.getByRole("button", { name: "列表视图" }));
    expect(thumbnail).toHaveAttribute("sizes", "60px");
    fireEvent.click(screen.getByRole("button", { name: `查看 ${item.title}` }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("img")).toHaveAttribute("src", item.image);
    expect(within(dialog).getByRole("img")).not.toHaveAttribute("srcset");
    expect(within(dialog).getByRole("link", { name: "保存图片" })).toHaveAttribute("href", item.image);
  });
  it("falls back from a failed thumbnail to its original only once", () => {
    const item = filterMedia("photos")[0];
    render(<CollectionThumbnail item={item} slot="filmstrip" alt={item.title} />);
    const image = screen.getByRole("img");
    expect(image).not.toHaveAttribute("src", item.image);
    fireEvent.error(image);
    expect(image).toHaveAttribute("src", item.image);
    expect(image).not.toHaveAttribute("srcset");
    fireEvent.error(image);
    expect(image).toHaveAttribute("src", item.image);
  });
  it("keeps failed-save feedback accessible inside the image dialog", () => {
    render(<GalleryApp initial="photos" favorites={[]} toggleFavorite={vi.fn()} favoritesSaved={false} />);
    expect(screen.getByText("收藏标记尚未保存")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看 暮色苍山" }));
    expect(within(screen.getByRole("dialog")).getByRole("status")).toHaveTextContent("存储空间或权限");
  });
  it("preserves incompatible saved data and explains the recovery copy", () => {
    const raw = '{"legacy":true}';
    localStorage.setItem("leo-daybook-bookmarks-v2", raw);
    render(<DaybookApp />);
    expect(screen.getByRole("status")).toHaveTextContent("已在本机保留备份");
    const backup = Object.keys(localStorage).find(key => key.startsWith("leo-daybook-bookmarks-v2:recovery:"))!;
    expect(localStorage.getItem(backup)).toBe(raw);
    fireEvent.click(screen.getByRole("button", { name: "给日记加书签" }));
    expect(JSON.parse(localStorage.getItem("leo-daybook-bookmarks-v2")!)).toEqual(["daily-2.jpg"]);
  });
  it("never replaces incompatible data when the recovery copy cannot be saved", () => {
    const raw = '{"legacy":true}';
    localStorage.setItem("leo-cinema-watchlist-v1", raw);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
    render(<CinemaApp />);
    fireEvent.click(screen.getByRole("button", { name: "加入待看清单" }));
    expect(screen.getByRole("status")).toHaveTextContent("原数据尚未覆盖");
    expect(localStorage.getItem("leo-cinema-watchlist-v1")).toBe(raw);
    expect(screen.getByRole("button", { name: "从待看清单移除" })).toBeInTheDocument();
  });
  it("normalizes a full legacy list on change and keeps the preference reloadable", () => {
    localStorage.setItem("leo-tasting-list-v1", JSON.stringify(Array.from({ length: 100 }, () => "old-dish")));
    const view = render(<TableStoriesApp />);
    fireEvent.click(screen.getByRole("button", { name: "加入想吃清单" }));
    expect(JSON.parse(localStorage.getItem("leo-tasting-list-v1")!)).toEqual(["food/sichuan-hotpot.jpg"]);
    view.unmount();
    render(<TableStoriesApp />);
    expect(screen.getByRole("button", { name: "从想吃清单移除" })).toBeInTheDocument();
  });
  it("explains an external watchlist conflict and keeps the local selection temporary until reopening", () => {
    const external = JSON.stringify([filterMedia("films")[1].id]);
    const view = render(<CinemaApp />);
    localStorage.setItem("leo-cinema-watchlist-v1", external);
    fireEvent.click(screen.getByRole("button", { name: "加入待看清单" }));
    expect(screen.getByRole("button", { name: "从待看清单移除" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("其他窗口或标签页更改了待看清单");
    expect(screen.getByRole("status")).toHaveTextContent("关闭并重新打开此应用");
    expect(localStorage.getItem("leo-cinema-watchlist-v1")).toBe(external);
    view.unmount();
    render(<CinemaApp />);
    expect(screen.getByRole("button", { name: "加入待看清单" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(localStorage.getItem("leo-cinema-watchlist-v1")).toBe(external);
  });
  it("opens film sources with explicit new-tab isolation", () => {
    render(<CinemaApp />);
    const link = screen.getByRole("link", { name: /影片资料/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
