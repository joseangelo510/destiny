import type { CSSProperties } from "react";

export function CompassCompanion({
  ariaLabel,
  completed,
  description = "It brightens as work is completed and real outcomes are verified.",
  title = "Your SEO compass",
  total,
  compact = false,
}: {
  ariaLabel?: string;
  completed: number;
  description?: string;
  title?: string;
  total: number;
  compact?: boolean;
}) {
  const safeTotal = Math.max(total, 1);
  const progress = Math.max(0, Math.min(100, Math.round((completed / safeTotal) * 100)));
  const style = {
    "--compass-progress": `${progress}%`,
    "--compass-opacity": String(0.18 + progress / 160),
  } as CSSProperties;
  return <figure className={`destiny-compass ${compact ? "compact" : ""}`} style={style}>
    <svg aria-label={ariaLabel ?? `Destiny compass illuminated to ${progress} percent`} role="img" viewBox="0 0 220 220">
      <defs>
        <radialGradient id="compass-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#d9ff75" stopOpacity=".95" />
          <stop offset="70%" stopColor="#7dbb8e" stopOpacity=".35" />
          <stop offset="100%" stopColor="#183f33" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="compass-needle" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#d9ff75" />
          <stop offset="100%" stopColor="#f0c34a" />
        </linearGradient>
      </defs>
      <circle className="compass-halo" cx="110" cy="110" r="100" fill="url(#compass-glow)" />
      <circle className="compass-rim" cx="110" cy="110" r="82" />
      <circle className="compass-inner" cx="110" cy="110" r="64" />
      <path className="compass-cross" d="M110 35V185M35 110H185" />
      <path className="compass-needle north" d="M110 48L132 116L110 106L88 116Z" fill="url(#compass-needle)" />
      <path className="compass-needle south" d="M110 172L88 104L110 114L132 104Z" />
      <circle className="compass-core" cx="110" cy="110" r="13" />
      <circle className="compass-core-dot" cx="110" cy="110" r="5" />
      <text x="110" y="26" textAnchor="middle">N</text>
      <text x="196" y="116" textAnchor="middle">E</text>
      <text x="110" y="205" textAnchor="middle">S</text>
      <text x="23" y="116" textAnchor="middle">W</text>
      {Array.from({ length: safeTotal }, (_, index) => {
        const angle = ((index / safeTotal) * Math.PI * 2) - (Math.PI / 2);
        const x = 110 + Math.cos(angle) * 92;
        const y = 110 + Math.sin(angle) * 92;
        return <circle className={index < completed ? "compass-stage lit" : "compass-stage"} cx={x} cy={y} key={index} r="4.5" />;
      })}
    </svg>
    {!compact && <figcaption><strong>{title}</strong><span>{description}</span></figcaption>}
  </figure>;
}
