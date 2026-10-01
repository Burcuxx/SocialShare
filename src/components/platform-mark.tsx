import type { Platform } from "@/lib/db";
import { PLATFORM_MARKS } from "@/lib/labels";

export function PlatformMark({
  platform,
  size = 36,
  muted = false,
}: {
  platform: Platform;
  size?: number;
  muted?: boolean;
}) {
  return (
    <span
      className={`mark mark-${platform}${muted ? " mark-muted" : ""}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      aria-hidden="true"
    >
      {PLATFORM_MARKS[platform]}
    </span>
  );
}
