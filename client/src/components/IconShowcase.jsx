import { motion } from 'framer-motion'
import { LevelIconTile } from './icons/LevelIcon.jsx'
import { LEVEL_ICONS } from './icons/levelIconMap.js'

export default function IconShowcase() {
  return (
    <section className="relative py-28 px-6 lg:px-12 overflow-hidden">
      {/* Section glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 65% 55% at 50% 50%, rgba(4,150,199,0.1) 0%, transparent 70%)',
        }}
      />

      <div className="max-w-7xl mx-auto relative z-10">

        {/* Section header */}
        <motion.div
          className="mb-16"
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="divider-gold" />
            <span className="label-overline">Icon System</span>
          </div>
          <h2
            className="font-serif text-white/90"
            style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', fontWeight: 400 }}
          >
            Icons{' '}
            <span
              style={{
                background: 'linear-gradient(105deg, #55E2E9, #0496C7)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              (Line Style)
            </span>
          </h2>
          <p
            className="font-sans font-light text-white/35 mt-3 max-w-md"
            style={{ fontSize: '0.88rem', lineHeight: 1.75 }}
          >
            A unified set of 20 premium minimal icons — thin strokes, soft gradients,
            elegant proportions. Hover to activate.
          </p>
        </motion.div>

        {/* Icon grid — 5 columns matching the reference layout */}
        <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-10 gap-x-6 gap-y-10">
          {LEVEL_ICONS.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10px' }}
              transition={{
                duration: 0.55,
                delay: i * 0.04,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <LevelIconTile
                icon={entry.icon}
                label={entry.label}
                gradient={entry.gradient}
                size={24}
              />
            </motion.div>
          ))}
        </div>

        {/* Stroke spec row */}
        <motion.div
          className="flex flex-wrap items-center gap-8 mt-16 pt-8"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          {[
            { label: 'Stroke Weight', value: '1.65 px' },
            { label: 'Line Cap',      value: 'Round'   },
            { label: 'Line Join',     value: 'Round'   },
            { label: 'Grid Size',     value: '24 × 24' },
            { label: 'Style',         value: 'Outline' },
          ].map(spec => (
            <div key={spec.label}>
              <p
                className="font-sans font-light text-white/25"
                style={{ fontSize: '0.62rem', letterSpacing: '0.14em', textTransform: 'uppercase' }}
              >
                {spec.label}
              </p>
              <p
                className="font-serif text-white/55 mt-0.5"
                style={{ fontSize: '0.88rem' }}
              >
                {spec.value}
              </p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
