/**
 * CompassRose — the Team Magnificent visual signature.
 *
 * Inline SVG so it inherits CSS color, scales without artifacts, and carries
 * the gold + teal accent identity. Used as the Section 1 hero mark on
 * tm-video-presentation and as a quiet anchor in the Section 11 footer.
 *
 * Design language: gold star points (8), teal center dot, faint gold rings.
 * The .motion-glow utility (main.css) gives it the soft pulse on the hero.
 *
 * Note: the locked spec references the actual logo asset at
 *   D:/momentum-creation-system-v1/assets/logos/logo_dark_hero.png
 * but for the dynamic, animated hero we render the SVG mark inline.
 * The PNG version is reserved for static contexts (OG card, email).
 */

export function CompassRose({
  size = 220,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  const cx = 100;
  const cy = 100;
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      role="presentation"
    >
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r="94" stroke="#C9A84C" strokeWidth="1" strokeOpacity="0.35" fill="none" />
      {/* Inner ring */}
      <circle cx={cx} cy={cy} r="74" stroke="#C9A84C" strokeWidth="1" strokeOpacity="0.55" fill="none" />

      {/* Cardinal long points (N, E, S, W) — large gold rhombi */}
      <g fill="#C9A84C">
        <polygon points="100,8 108,100 100,92 92,100" />
        <polygon points="192,100 100,108 108,100 100,92" />
        <polygon points="100,192 92,100 100,108 108,100" />
        <polygon points="8,100 100,92 92,100 100,108" />
      </g>

      {/* Intercardinal short points (NE, SE, SW, NW) — smaller gold-bright rhombi */}
      <g fill="#F5C030">
        <polygon points="160,40 105,95 100,100 95,95" transform="rotate(45 100 100)" />
        <polygon points="160,40 105,95 100,100 95,95" transform="rotate(135 100 100)" />
        <polygon points="160,40 105,95 100,100 95,95" transform="rotate(225 100 100)" />
        <polygon points="160,40 105,95 100,100 95,95" transform="rotate(315 100 100)" />
      </g>

      {/* Hub: dark inner disc with teal center */}
      <circle cx={cx} cy={cy} r="14" fill="#0A0A0A" stroke="#C9A84C" strokeWidth="1" strokeOpacity="0.8" />
      <circle cx={cx} cy={cy} r="5" fill="#2DD4BF" />
    </svg>
  );
}
