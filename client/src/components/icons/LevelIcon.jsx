import { motion } from 'framer-motion'

/**
 * LEVEL Icon System — luxury line-art wrapper.
 *
 * Renders any Lucide icon with gradient SVG strokes + optional hover animation.
 * Requires <IconDefs /> to be mounted once in the document tree.
 *
 * gradient variants:
 *   "primary" — deep navy → ocean → cyan  (default)
 *   "ocean"   — mid-blue → light cyan
 *   "soft"    — pale blue → icy cyan
 *   "gold"    — old-money amber shimmer
 *   "mono"    — soft white (for dark cards)
 */

const STROKE_MAP = {
  primary: 'url(#lvl-g-primary)',
  ocean:   'url(#lvl-g-ocean)',
  soft:    'url(#lvl-g-soft)',
  gold:    'url(#lvl-g-gold)',
  mono:    'url(#lvl-g-mono)',
}

export function LevelIcon({
  icon: Icon,
  size        = 22,
  gradient    = 'primary',
  strokeWidth = 1.65,
  hoverable   = false,
  className   = '',
  style       = {},
}) {
  const stroke = STROKE_MAP[gradient] ?? STROKE_MAP.primary

  const iconEl = (
    <Icon
      width={size}
      height={size}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  )

  if (!hoverable) {
    return (
      <span
        className={`inline-flex items-center justify-center ${className}`}
        style={style}
        aria-hidden="true"
      >
        {iconEl}
      </span>
    )
  }

  return (
    <motion.span
      className={`inline-flex items-center justify-center cursor-pointer ${className}`}
      style={style}
      whileHover={{
        scale: 1.13,
        filter: 'drop-shadow(0 0 9px rgba(4,186,222,0.55))',
      }}
      whileTap={{ scale: 0.94 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      aria-hidden="true"
    >
      {iconEl}
    </motion.span>
  )
}

/** Convenience: a labelled icon tile for showcases and feature lists */
export function LevelIconTile({ icon, label, gradient = 'primary', size = 26 }) {
  return (
    <motion.div
      className="flex flex-col items-center gap-3 group"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-20px' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <LevelIcon
        icon={icon}
        size={size}
        gradient={gradient}
        hoverable
        className="w-14 h-14 rounded-xl transition-all duration-300"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
        }}
      />
      <span
        className="font-sans font-light text-white/40 text-center leading-tight"
        style={{ fontSize: '0.65rem', letterSpacing: '0.08em' }}
      >
        {label}
      </span>
    </motion.div>
  )
}
