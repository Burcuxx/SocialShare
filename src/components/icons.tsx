/** Inline stroke icons (2px, currentColor). */
type P = { size?: number };
const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const ArrowRight = ({ size = 18 }: P) => (
  <svg {...base(size)}><path d="M4 12h14" /><path d="M13 6l6 6-6 6" /></svg>
);
export const ChevronLeft = ({ size = 18 }: P) => (
  <svg {...base(size)}><path d="M15 6l-6 6 6 6" /></svg>
);
export const ChevronRight = ({ size = 18 }: P) => (
  <svg {...base(size)}><path d="M9 6l6 6-6 6" /></svg>
);
export const ChevronDown = ({ size = 16 }: P) => (
  <svg {...base(size)}><path d="M6 9l6 6 6-6" /></svg>
);
export const Upload = ({ size = 24 }: P) => (
  <svg {...base(size)}><path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M4 20h16" /></svg>
);
export const Close = ({ size = 18 }: P) => (
  <svg {...base(size)}><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
);
export const Search = ({ size = 16 }: P) => (
  <svg {...base(size)}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
);
export const Retry = ({ size = 16 }: P) => (
  <svg {...base(size)}><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 5v6h-6" /></svg>
);
export const Play = ({ size = 34 }: P) => (
  <svg {...base(size)} strokeWidth={1.6}><circle cx="12" cy="12" r="10" /><path d="M10 8.5l5 3.5-5 3.5z" /></svg>
);
export const Info = ({ size = 14 }: P) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 16.5v.01" /></svg>
);
