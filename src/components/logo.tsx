type Props = {
  size?: number;
  /** onDark: lime square, dark symbol. onLight: dark square, lime symbol. */
  variant?: "onDark" | "onLight";
  showText?: boolean;
};

/** The dot is the one uploaded video; the three arms are YouTube, TikTok and Instagram. */
export function Logo({ size = 32, variant = "onDark", showText = true }: Props) {
  const bg = variant === "onDark" ? "#C8F169" : "#17181C";
  const fg = variant === "onDark" ? "#17181C" : "#C8F169";
  return (
    <span className="logo">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill={bg} />
        <path
          d="M12.5 16L22 9.5M12.5 16H22.5M12.5 16L22 22.5"
          stroke={fg}
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="9.5" cy="16" r="3.2" fill={fg} />
        <circle cx="23.2" cy="9" r="2.3" fill={fg} />
        <circle cx="23.8" cy="16" r="2.3" fill={fg} />
        <circle cx="23.2" cy="23" r="2.3" fill={fg} />
      </svg>
      {showText && (
        <span className="logo-text" style={{ fontSize: Math.round(size * 0.62) }}>
          Social Share
        </span>
      )}
    </span>
  );
}
