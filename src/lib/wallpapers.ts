import forest from "@/images/bg-forest.jpg";
import mountain from "@/images/bg-mountain.jpg";
import lake from "@/images/bg-lake.jpg";
import meadow from "@/images/bg-meadow.jpg";

export const WALLPAPER_KEY = "ses-wallpaper";
export const WALLPAPER_NONE = "none";

export const WALLPAPERS = [
  { id: "forest", src: forest, label: "O'rmon" },
  { id: "mountain", src: mountain, label: "Tog'" },
  { id: "lake", src: lake, label: "Ko'l" },
  { id: "meadow", src: meadow, label: "Yaylov" },
] as const;

export type WallpaperId = (typeof WALLPAPERS)[number]["id"];
export const DEFAULT_WALLPAPER: WallpaperId = "meadow";

export function getStoredWallpaper(): WallpaperId | null {
  try {
    const stored = localStorage.getItem(WALLPAPER_KEY);
    if (stored === WALLPAPER_NONE) return null;
    if (WALLPAPERS.some(w => w.id === stored)) return stored as WallpaperId;
  } catch {
    /* ignore */
  }
  return DEFAULT_WALLPAPER;
}

export function wallpaperSrc(id: WallpaperId | null): string | null {
  return WALLPAPERS.find(w => w.id === id)?.src ?? null;
}
