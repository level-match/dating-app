/**
 * Global SVG gradient definitions — mounted once at the app root.
 * Gradients are document-scoped, so any SVG on the page can reference
 * them as stroke="url(#lvl-g-primary)" etc.
 */
export default function IconDefs() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      style={{ position: 'absolute', overflow: 'hidden', pointerEvents: 'none' }}
    >
      <defs>
        {/* Primary: deep navy → ocean → cyan */}
        <linearGradient id="lvl-g-primary" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#02367B" />
          <stop offset="52%"  stopColor="#0496C7" />
          <stop offset="100%" stopColor="#55E2E9" />
        </linearGradient>

        {/* Ocean: mid-blue → light cyan */}
        <linearGradient id="lvl-g-ocean" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#006CA5" />
          <stop offset="100%" stopColor="#55E2E9" />
        </linearGradient>

        {/* Soft: pale blue → icy cyan */}
        <linearGradient id="lvl-g-soft" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#0496C7" />
          <stop offset="100%" stopColor="#A8F0F4" />
        </linearGradient>

        {/* Gold: old-money amber shimmer */}
        <linearGradient id="lvl-g-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#B8903A" />
          <stop offset="55%"  stopColor="#D4AF5A" />
          <stop offset="100%" stopColor="#E2C97E" />
        </linearGradient>

        {/* Mono: subtle white-on-dark for inverse contexts */}
        <linearGradient id="lvl-g-mono" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.55)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.85)" />
        </linearGradient>
      </defs>
    </svg>
  )
}
