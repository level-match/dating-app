import { motion } from 'framer-motion'
import adrianPhoto from '../../assets/adrian.jpg'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] },
})

const LAYERS = [
  { label: 'Government ID', note: 'Matched to a verified identity', color: '#9BCBB4' },
  { label: 'Selfie & Photo', note: 'Live capture compared to ID', color: '#B8A8D4' },
  { label: 'Career & Title', note: 'Confirmed against public record', color: '#E8C7A0' },
  { label: 'Email verification', note: 'One-time email code on sign-in', color: '#E5B5B5' },
]

const CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}><path d="M20 6L9 17l-5-5" /></svg>
)

export default function VerificationSection() {
  return (
    <section id="verification" className="relative py-28 lg:py-32 px-6 lg:px-10">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

        {/* Copy — left */}
        <motion.div className="max-w-xl" {...fadeUp()}>
          <div className="flex items-center gap-3 mb-6">
            <div className="hairline" />
            <span className="eyebrow">Professional Verification</span>
          </div>
          <h2 className="font-display text-cream-50 leading-[1.08] text-balance" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.4rem)', fontWeight: 300, letterSpacing: '-0.02em' }}>
            Every member,
            <br />
            <span className="accent-italic text-prism">multi-layer verified.</span>
          </h2>
          <p className="font-sans text-cream-100/60 mt-7" style={{ fontSize: '1rem', lineHeight: 1.85, fontWeight: 300 }}>
            Trust is the quiet foundation of a serious community. Before anyone is
            introduced, they pass through the LEVEL Identity Gateway — so the person
            in the profile is exactly who they say they are.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            {LAYERS.map(l => (
              <div key={l.label} className="surface flex items-center gap-4" style={{ borderRadius: 14, padding: '14px 16px' }}>
                <span className="flex items-center justify-center flex-shrink-0" style={{ width: 30, height: 30, borderRadius: 999, color: l.color, background: `${l.color}1F`, border: `1px solid ${l.color}55` }}>{CHECK}</span>
                <div>
                  <div className="font-sans text-cream-50" style={{ fontSize: '0.9rem', fontWeight: 500 }}>{l.label}</div>
                  <div className="font-sans text-cream-100/50" style={{ fontSize: '0.76rem' }}>{l.note}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Visual — right: verified profile card */}
        <motion.div {...fadeUp(0.1)}>
          <div className="surface overflow-hidden mx-auto" style={{ borderRadius: 22, maxWidth: 400 }}>
            <div className="relative" style={{ aspectRatio: '3 / 2.6' }}>
              <img src={adrianPhoto} alt="Verified member" className="absolute inset-0 w-full h-full object-cover" style={{ filter: 'saturate(0.94) contrast(1.02)' }} />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(7,6,17,0.1) 35%, rgba(7,6,17,0.92) 100%)' }} />
              <span className="absolute font-sans inline-flex items-center gap-1.5"
                style={{ top: 14, right: 14, fontSize: '0.58rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500, color: '#070611', background: 'linear-gradient(135deg, #E8C7A0, #D4A574)', padding: '5px 10px', borderRadius: 999 }}>
                <span style={{ width: 11, height: 11 }}>{CHECK}</span> Multi-Layer Verified
              </span>
              <div className="absolute left-0 right-0 bottom-0 p-5">
                <div className="font-display text-cream-50" style={{ fontSize: '1.5rem', fontWeight: 400 }}>Adrian Reyes</div>
                <div className="font-sans text-cream-100/60" style={{ fontSize: '0.78rem', marginTop: 2 }}>Cardiothoracic Surgeon · Toronto</div>
                <div className="flex flex-wrap gap-1.5" style={{ marginTop: 14 }}>
                  {[['ID', '#9BCBB4'], ['Career', '#E8C7A0'], ['Photo', '#B8A8D4'], ['Premium', '#E5B5B5']].map(([t, c]) => (
                    <span key={t} className="inline-flex items-center gap-1 font-sans" style={{ fontSize: '0.56rem', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 999, color: c, background: `${c}1A`, border: `1px solid ${c}40` }}>
                      <span style={{ width: 8, height: 8, color: c }}>{CHECK}</span>{t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
