import { formatDuration } from "@/i18n";
import { Play } from "./icons";

/** No thumbnails are stored; a muted tone per video stands in for one. */
const TONES = ["#5B5F97", "#3E7C6B", "#9A5B3E", "#4A4D55", "#7A5C99", "#2F6690", "#8C7A3B", "#5E6B4E"];

export function VideoThumb({ id, durationSec, large = false }: {
  id: number;
  durationSec: number | null;
  large?: boolean;
}) {
  const dur = formatDuration(durationSec);
  return (
    <span className={`thumb${large ? " thumb-lg" : ""}`} style={{ background: TONES[id % TONES.length] }}>
      {large && <Play size={44} />}
      {dur && <span className="thumb-dur num">{dur}</span>}
    </span>
  );
}
