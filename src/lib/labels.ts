import type { Platform } from "./db";

/** Brand names: not translated. */
export const PLATFORM_NAMES: Record<Platform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
};

/** Two-letter marks shown in the colored platform squares. */
export const PLATFORM_MARKS: Record<Platform, string> = {
  youtube: "Yt",
  tiktok: "Tk",
  instagram: "Ig",
};

export const PLATFORMS: Platform[] = ["youtube", "tiktok", "instagram"];
