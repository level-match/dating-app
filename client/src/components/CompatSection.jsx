import { useRef, useState } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { User, HeartPulse, Compass, Briefcase, Target } from 'lucide-react'

const DIMENSIONS = [
  {
    key: 'identity',
    label: 'Identity',
    accent: '#E5B5B5',
    Icon: User,
    blurb:
      'Gender, orientation and pronouns at the foundation — so connection starts from being truly seen.',
    items: [
      { name: 'Gender Identity',     score: 92 },
      { name: 'Pronouns',            score: 96 },
      { name: 'Sexual Orientation',  score: 88 },
      { name: 'Preferred Genders',   score: 91 },
      { name: 'Relationship Model',  score: 84 },
    ],
  },
  {
    key: 'emotional',
    label: 'Emotional',
    accent: '#E8C7A0',
    Icon: HeartPulse,
    blurb:
      'How you connect, repair and grow — emotional fluency, the strongest predictor of lasting love.',
    items: [
      { name: 'Attachment Style',    score: 87 },
      { name: 'Conflict Style',      score: 82 },
      { name: 'Love Languages',      score: 90 },
      { name: 'Emotional Depth',     score: 85 },
      { name: 'Communication Pace',  score: 89 },
    ],
  },
  {
    key: 'lifestyle',
    label: 'Lifestyle',
    accent: '#9BCBB4',
    Icon: Compass,
    blurb:
      'How you travel, host, recover and spend Sunday mornings. Compatibility lives in the everyday.',
    items: [
      { name: 'Travel Cadence',      score: 81 },
      { name: 'Social Energy',       score: 86 },
      { name: 'Wellness Habits',     score: 79 },
      { name: 'Home & Hosting',      score: 84 },
      { name: 'Financial Approach',  score: 88 },
    ],
  },
  {
    key: 'career',
    label: 'Career',
    accent: '#B8A8D4',
    Icon: Briefcase,
    blurb:
      'Ambition, intensity and what success looks like — so neither of you has to dim the work.',
    items: [
      { name: 'Career Intensity',    score: 90 },
      { name: 'Creative Drive',      score: 83 },
      { name: 'Risk Appetite',       score: 78 },
      { name: 'Time Investment',     score: 86 },
      { name: 'Legacy Goals',        score: 81 },
    ],
  },
  {
    key: 'intentions',
    label: 'Long-term',
    accent: '#D4A574',
    Icon: Target,
    blurb:
      "Where you'll live, children, marriage timelines, and the partnership model you actually believe in.",
    items: [
      { name: 'Marriage Timeline',   score: 89 },
      { name: 'Family Plans',        score: 91 },
      { name: 'Geographic Vision',   score: 80 },
      { name: 'Partnership Model',   score: 86 },
      { name: 'Faith & Worldview',   score: 78 },
    ],
  },
]

function AnimatedBar({ score, accent, delay }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: false, margin: '-30px' })

  return (
    <div
      ref={ref}
      className="h-[3px] rounded-full overflow-hidden"
      style={{ background: 'rgba(245,237,224,0.05)' }}
    >
      <motion.div
        className="h-full rounded-full"
        style={{
          background: `linear-gradient(90deg, ${accent}cc, ${accent}55)`,
          boxShadow: `0 0 12px ${accent}66`,
        }}
        initial={{ width: 0 }}
        animate={inView ? { width: `${score}%` } : { width: 0 }}
        transition={{ duration: 1, delay, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  )
}

export default function CompatSection() {
  const [activeKey, setActiveKey] = useState('identity')
  const active = DIMENSIONS.find(d => d.key === activeKey)

  return (
    <section id="matching" className="relative py-32 px-6 lg:px-10 overflow-hidden">
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          width: '40vw',
          height: '60vh',
          background:
            'radial-gradient(ellipse, rgba(184,168,212,0.20) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid lg:grid-cols-2 gap-20 items-start">

          {/* Left — copy + tabs */}
          <motion.div
            initial={{ opacity: 0, x: -32 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="hairline-prism" />
              <span className="eyebrow">The matching</span>
            </div>
            <h2
              className="font-display text-cream-50 leading-[1.05] mb-8 text-balance"
              style={{ fontSize: 'clamp(2.2rem, 4.2vw, 3.6rem)', fontWeight: 300, letterSpacing: '-0.025em' }}
            >
              52 signals.
              <br />
              <span className="accent-italic text-prism">One real you.</span>
            </h2>
            <p
              className="font-sans text-cream-100/65 leading-relaxed mb-10"
              style={{ fontSize: '1rem', lineHeight: 1.9, fontWeight: 300 }}
            >
              Most platforms reduce people to a few photos and a guess. LEVEL maps
              how you live, how you love, and what you want next.
            </p>

            <div className="flex flex-wrap gap-2">
              {DIMENSIONS.map(d => {
                const isActive = d.key === activeKey
                return (
                  <button
                    key={d.key}
                    onClick={() => setActiveKey(d.key)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-sans transition-all duration-400"
                    style={{
                      fontSize: '0.74rem',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      background: isActive
                        ? `${d.accent}1A`
                        : 'rgba(245,237,224,0.04)',
                      border: `1px solid ${isActive ? `${d.accent}66` : 'rgba(245,237,224,0.10)'}`,
                      color: isActive ? d.accent : 'rgba(245,237,224,0.50)',
                      boxShadow: isActive ? `0 0 24px ${d.accent}22` : 'none',
                    }}
                  >
                    <d.Icon size={14} strokeWidth={1.7} />
                    {d.label}
                  </button>
                )
              })}
            </div>
          </motion.div>

          {/* Right — visualizer */}
          <motion.div
            initial={{ opacity: 0, x: 32 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          >
            <div className="surface rounded-3xl p-8 lg:p-10 relative overflow-hidden">
              {/* Accent halo */}
              <div
                key={`halo-${active.key}`}
                className="absolute pointer-events-none"
                style={{
                  width: '320px',
                  height: '320px',
                  top: '-100px',
                  right: '-90px',
                  background: `radial-gradient(circle, ${active.accent}33 0%, transparent 65%)`,
                  filter: 'blur(40px)',
                  animation: 'fadeUp 1s cubic-bezier(0.16,1,0.3,1) both',
                }}
              />

              <AnimatePresence mode="wait">
                <motion.div
                  key={active.key}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.4 }}
                  className="relative"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="eyebrow" style={{ color: active.accent }}>
                        {active.label}
                      </p>
                      <p
                        className="font-display text-cream-50 mt-1"
                        style={{ fontSize: '1.4rem', fontWeight: 400 }}
                      >
                        Compatibility map
                      </p>
                    </div>
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center font-display"
                      style={{
                        background: `${active.accent}14`,
                        border: `1px solid ${active.accent}40`,
                        color: active.accent,
                        fontSize: '1.3rem',
                        fontWeight: 400,
                      }}
                    >
                      52
                    </div>
                  </div>

                  <p
                    className="font-sans text-cream-100/55 mb-8"
                    style={{ fontSize: '0.92rem', lineHeight: 1.85, fontWeight: 300 }}
                  >
                    {active.blurb}
                  </p>

                  <div className="space-y-5">
                    {active.items.map((item, i) => (
                      <div key={item.name}>
                        <div className="flex justify-between items-center mb-2">
                          <span
                            className="font-sans text-cream-100/70"
                            style={{ fontSize: '0.86rem', fontWeight: 400 }}
                          >
                            {item.name}
                          </span>
                          <span
                            className="font-display"
                            style={{ fontSize: '0.78rem', color: active.accent, fontWeight: 400 }}
                          >
                            {item.score}%
                          </span>
                        </div>
                        <AnimatedBar score={item.score} accent={active.accent} delay={i * 0.08} />
                      </div>
                    ))}
                  </div>

                  <div
                    className="mt-8 pt-6 flex items-center gap-3"
                    style={{ borderTop: '1px solid rgba(245,237,224,0.06)' }}
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0 animate-glow-pulse"
                      style={{ background: active.accent }}
                    />
                    <span
                      className="font-sans text-cream-100/40"
                      style={{ fontSize: '0.74rem', lineHeight: 1.6 }}
                    >
                      Refined continually by your answers, behaviour and the matches you choose.
                    </span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
