import { motion } from 'framer-motion'
import jamesPhoto from '../../assets/james-t.jpg'
import miaPhoto from '../../assets/mia-santos.jpg'
import sarahPhoto from '../../assets/sarah-m.jpg'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] },
})

const CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ width: 9, height: 9 }}><path d="M20 6L9 17l-5-5" /></svg>
)

function Badge({ label, color }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 font-sans"
      style={{
        fontSize: '0.56rem', letterSpacing: '0.12em', textTransform: 'uppercase',
        padding: '3px 7px', borderRadius: 999,
        color, background: `${color}1A`, border: `1px solid ${color}40`,
      }}
    >
      <span style={{ color }}>{CHECK}</span>{label}
    </span>
  )
}

function MatchCard({ photo, name, role, score, summary, status, statusColor, big }) {
  return (
    <div className="surface overflow-hidden" style={{ borderRadius: 18 }}>
      <div className="relative" style={{ aspectRatio: big ? '3 / 3.4' : '3 / 2.4' }}>
        <img src={photo} alt={name} className="absolute inset-0 w-full h-full object-cover" style={{ filter: 'saturate(0.94) contrast(1.02)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 30%, rgba(7,6,17,0.55) 66%, rgba(7,6,17,0.94) 100%)' }} />
        <span
          className="absolute font-sans"
          style={{ top: 12, left: 12, fontSize: '0.56rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: statusColor, background: 'rgba(7,6,17,0.7)', border: `1px solid ${statusColor}55`, padding: '3px 8px', borderRadius: 999, backdropFilter: 'blur(6px)' }}
        >{status}</span>
        <div className="absolute left-0 right-0 bottom-0 p-4">
          <div className="font-display text-cream-50" style={{ fontSize: big ? '1.4rem' : '1.15rem', fontWeight: 400, lineHeight: 1.1 }}>{name}</div>
          <div className="font-sans text-cream-100/60" style={{ fontSize: '0.72rem', marginTop: 2 }}>{role}</div>
          <div className="font-sans" style={{ marginTop: 10, fontSize: '0.62rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(245,237,224,0.62)' }}>
            <span className="font-display" style={{ fontSize: '1.05rem', letterSpacing: 0, textTransform: 'none', color: '#E8C7A0' }}>{score}%</span> Compatibility Alignment
          </div>
          {big && <div className="font-sans text-cream-100/70" style={{ fontSize: '0.74rem', lineHeight: 1.45, marginTop: 7 }}>{summary}</div>}
          <div className="flex flex-wrap gap-1.5" style={{ marginTop: 12 }}>
            <Badge label="ID" color="#9BCBB4" />
            <Badge label="Career" color="#E8C7A0" />
            <Badge label="Photo" color="#B8A8D4" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MatchDiscoverySection() {
  return (
    <section id="discovery" className="relative py-28 lg:py-32 px-6 lg:px-10">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

        {/* Visual — left */}
        <motion.div className="order-2 lg:order-1" {...fadeUp()}>
          <div className="grid grid-cols-2 gap-4">
            <div className="row-span-2">
              <MatchCard big photo={jamesPhoto} name="James T." role="Founder & CEO · New York" score={96} status="Mutual" statusColor="#9BCBB4"
                summary="Strong overlap in career chapter, ambition, and long-term family intent." />
            </div>
            <MatchCard photo={miaPhoto} name="Mia Santos" role="Pediatric Surgeon · Madrid" score={94} status="New" statusColor="#B8A8D4" />
            <MatchCard photo={sarahPhoto} name="Sarah M." role="IP Partner · London" score={91} status="Pending" statusColor="#E8C7A0" />
          </div>
        </motion.div>

        {/* Copy — right */}
        <motion.div className="order-1 lg:order-2 max-w-xl" {...fadeUp(0.1)}>
          <div className="flex items-center gap-3 mb-6">
            <div className="hairline" />
            <span className="eyebrow">Match Discovery</span>
          </div>
          <h2 className="font-display text-cream-50 leading-[1.08] text-balance" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.4rem)', fontWeight: 300, letterSpacing: '-0.02em' }}>
            Curated introductions,
            <br />
            <span className="accent-italic text-prism">not an endless feed.</span>
          </h2>
          <p className="font-sans text-cream-100/60 mt-7" style={{ fontSize: '1rem', lineHeight: 1.85, fontWeight: 300 }}>
            You land on a considered Match Dashboard — a small set of high-intent,
            verified members chosen for genuine alignment. No swiping, no infinite
            scroll. Review each person with the depth they deserve.
          </p>
          <ul className="mt-7 flex flex-col gap-3">
            {[
              ['#E8C7A0', 'A clean final compatibility score — never the raw math'],
              ['#9BCBB4', 'Verification badges on every introduction'],
              ['#B8A8D4', 'A short, plain-language reason you align'],
            ].map(([c, t]) => (
              <li key={t} className="flex items-start gap-3 font-sans text-cream-100/75" style={{ fontSize: '0.92rem', lineHeight: 1.6 }}>
                <span style={{ marginTop: 8, width: 6, height: 6, borderRadius: 999, background: c, boxShadow: `0 0 10px ${c}`, flexShrink: 0 }} />
                {t}
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  )
}
