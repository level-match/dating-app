import { motion } from 'framer-motion'
import jamesPhoto from '../../assets/james.jpg'
import { maintenanceUrl } from '../../js/maintenance.js'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 1, delay, ease: [0.16, 1, 0.3, 1] },
})

const CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ width: 9, height: 9 }}><path d="M20 6L9 17l-5-5" /></svg>
)

function HeroPreview() {
  return (
    <motion.div
      className="w-full max-w-sm mx-auto lg:ml-auto"
      initial={{ opacity: 0, y: 36 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.1, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="surface overflow-hidden" style={{ borderRadius: 24 }}>
        <div className="relative" style={{ aspectRatio: '3 / 3.5' }}>
          <img src={jamesPhoto} alt="A LEVEL member" className="absolute inset-0 w-full h-full object-cover" style={{ filter: 'saturate(0.94) contrast(1.02)' }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(7,6,17,0.05) 28%, rgba(7,6,17,0.6) 62%, rgba(7,6,17,0.96) 100%)' }} />
          <span className="absolute font-sans inline-flex items-center gap-1.5"
            style={{ top: 14, right: 14, fontSize: '0.56rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500, color: '#070611', background: 'linear-gradient(135deg, #E8C7A0, #D4A574)', padding: '4px 9px', borderRadius: 999 }}>
            <span style={{ width: 10, height: 10 }}>{CHECK}</span> Verified
          </span>
          <div className="absolute left-0 right-0 bottom-0 p-5">
            <div className="font-display text-cream-50" style={{ fontSize: '1.6rem', fontWeight: 400, lineHeight: 1.05 }}>James T.</div>
            <div className="font-sans text-cream-100/60" style={{ fontSize: '0.8rem', marginTop: 3 }}>Founder &amp; CEO · New York</div>
            <div className="font-sans" style={{ marginTop: 12, fontSize: '0.62rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(245,237,224,0.62)' }}>
              <span className="font-display" style={{ fontSize: '1.25rem', letterSpacing: 0, textTransform: 'none', color: '#E8C7A0' }}>96%</span> Compatibility Alignment
            </div>
            <div className="font-sans text-cream-100/70" style={{ fontSize: '0.78rem', lineHeight: 1.45, marginTop: 8 }}>
              Strong overlap in career chapter, ambition, and long-term family intent.
            </div>
            <div className="flex flex-wrap gap-1.5" style={{ marginTop: 14 }}>
              {[['ID', '#9BCBB4'], ['Career', '#E8C7A0'], ['Photo', '#B8A8D4']].map(([t, c]) => (
                <span key={t} className="inline-flex items-center gap-1 font-sans" style={{ fontSize: '0.56rem', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 999, color: c, background: `${c}1A`, border: `1px solid ${c}40` }}>
                  <span style={{ width: 8, height: 8, color: c }}>{CHECK}</span>{t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden px-6 lg:px-10">

      {/* Hero gradient sweep */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 55%, rgba(4,150,199,0.22) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 w-full max-w-7xl mx-auto grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center pt-28 pb-28">

        {/* Copy — left */}
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">

          <motion.div className="flex items-center gap-4 mb-8" {...fadeUp(0.3)}>
            <div className="divider-gold" />
            <span className="label-overline">When Lives Align</span>
            <div className="divider-gold" />
          </motion.div>

          <motion.h1
            className="font-display text-white text-balance"
            style={{ fontSize: 'clamp(2.1rem, 5vw, 4rem)', fontWeight: 300, letterSpacing: '-0.02em', lineHeight: 1.12 }}
            {...fadeUp(0.45)}
          >
            The right person already exists.<br />
            <span
              className="accent-italic"
              style={{
                background: 'linear-gradient(105deg, #55E2E9 0%, #04BADE 45%, #0496C7 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}
            >
              You just haven&apos;t crossed paths yet.
            </span>
          </motion.h1>

          <motion.p
            className="font-sans font-light text-white/60 max-w-xl leading-relaxed mt-7 text-balance"
            style={{ fontSize: 'clamp(0.95rem, 2vw, 1.08rem)', lineHeight: 1.8 }}
            {...fadeUp(0.6)}
          >
            A curated space for intentional people — where shared values, ambition,
            and life direction become genuine alignment.
          </motion.p>

          <motion.div className="mt-10" {...fadeUp(0.75)}>
            <a
              href={maintenanceUrl('signup')}
              className="inline-flex items-center font-sans font-medium text-white px-10 py-4 rounded-full transition-all duration-400"
              style={{
                fontSize: '0.82rem', letterSpacing: '0.14em', textTransform: 'uppercase',
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.28)',
                backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(4,186,222,0.18)'
                e.currentTarget.style.borderColor = 'rgba(85,226,233,0.55)'
                e.currentTarget.style.boxShadow = '0 0 36px rgba(4,186,222,0.22), 0 8px 32px rgba(0,0,0,0.3)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.28)'
                e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.2)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              Sign Up
            </a>
            <p className="font-sans font-light text-white/40 mt-4" style={{ fontSize: '0.7rem', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              Verified users only.
            </p>
          </motion.div>

          {/* Trust stats */}
          <motion.div
            className="flex items-center justify-center lg:justify-start gap-10 mt-12 flex-wrap"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 1 }}
          >
            {[
              { value: '94%', label: 'Match Satisfaction' },
              { value: '42', label: 'Compatibility Dimensions' },
              { value: 'Multi-Layer', label: 'Verified Accounts' },
            ].map(stat => (
              <div key={stat.label} className="text-center lg:text-left">
                <div className="font-serif text-white/90 font-light" style={{ fontSize: '1.75rem', letterSpacing: '-0.02em' }}>{stat.value}</div>
                <div className="font-sans font-light text-white/35 mt-1" style={{ fontSize: '0.66rem', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Preview — right */}
        <HeroPreview />
      </div>

      {/* Scroll cue */}
      <motion.div
        className="absolute bottom-10 left-1/2 -translate-x-1/2 hidden lg:flex flex-col items-center gap-2"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2, duration: 1 }}
      >
        <span className="font-sans font-light text-white/25" style={{ fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase' }}>Scroll</span>
        <div className="w-px h-10 overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <motion.div className="w-full" style={{ height: '50%', background: 'linear-gradient(180deg, rgba(4,186,222,0.8), transparent)' }} animate={{ y: ['0%', '200%'] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }} />
        </div>
      </motion.div>
    </section>
  )
}
