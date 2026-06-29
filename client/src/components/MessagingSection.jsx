import { motion } from 'framer-motion'
import miaPhoto from '../../assets/mia-santos.jpg'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] },
})

const THREAD = [
  { from: 'them', text: 'Surgery taught me steady hands come from a settled mind. Your note about building quietly really resonated.' },
  { from: 'me', text: "That means a lot. I'd love to hear how you protect that calm with a schedule like yours." },
  { from: 'them', text: 'Sundays are sacred — galleries, no screens. Would you want to compare notes over dinner this week?' },
]

function Bubble({ from, text }) {
  const me = from === 'me'
  return (
    <div className={`flex ${me ? 'justify-end' : 'justify-start'}`}>
      <div
        className="font-sans"
        style={{
          maxWidth: '78%', fontSize: '0.82rem', lineHeight: 1.5, padding: '10px 14px',
          borderRadius: me ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          color: me ? '#1A1335' : 'rgba(245,237,224,0.88)',
          background: me ? 'linear-gradient(135deg, #E8C7A0, #D4A574)' : 'rgba(245,237,224,0.06)',
          border: me ? 'none' : '1px solid rgba(245,237,224,0.10)',
        }}
      >{text}</div>
    </div>
  )
}

export default function MessagingSection() {
  return (
    <section id="messaging" className="relative py-28 lg:py-32 px-6 lg:px-10">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

        {/* Visual — left: chat thread */}
        <motion.div className="order-2 lg:order-1" {...fadeUp()}>
          <div className="surface mx-auto" style={{ borderRadius: 22, maxWidth: 420, overflow: 'hidden' }}>
            {/* header */}
            <div className="flex items-center gap-3" style={{ padding: '14px 18px', borderBottom: '1px solid rgba(245,237,224,0.08)' }}>
              <div style={{ position: 'relative' }}>
                <img src={miaPhoto} alt="Mia Santos" style={{ width: 40, height: 40, borderRadius: 999, objectFit: 'cover' }} />
                <span style={{ position: 'absolute', right: -1, bottom: -1, width: 11, height: 11, borderRadius: 999, background: '#7BB59B', border: '2px solid #0B0819' }} />
              </div>
              <div>
                <div className="font-display text-cream-50" style={{ fontSize: '1.05rem' }}>Mia Santos</div>
                <div className="font-sans text-cream-100/45" style={{ fontSize: '0.7rem' }}>Online now · 94% alignment</div>
              </div>
            </div>
            {/* messages */}
            <div className="flex flex-col gap-3" style={{ padding: '18px' }}>
              {THREAD.map((m, i) => <Bubble key={i} {...m} />)}
              {/* date suggestion card */}
              <div style={{ marginTop: 6, borderRadius: 14, padding: '14px 16px', background: 'rgba(212,165,116,0.08)', border: '1px solid rgba(212,165,116,0.28)' }}>
                <div className="font-sans" style={{ fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#E8C7A0', fontWeight: 500 }}>Concierge · Date Suggestion</div>
                <div className="font-display text-cream-50" style={{ fontSize: '1.05rem', marginTop: 3 }}>Dinner at Gramercy Tavern</div>
                <div className="font-sans text-cream-100/50" style={{ fontSize: '0.74rem' }}>Friday · 7:30 PM · arranged for you</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Copy — right */}
        <motion.div className="order-1 lg:order-2 max-w-xl" {...fadeUp(0.1)}>
          <div className="flex items-center gap-3 mb-6">
            <div className="hairline" />
            <span className="eyebrow">Messaging &amp; Introductions</span>
          </div>
          <h2 className="font-display text-cream-50 leading-[1.08] text-balance" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.4rem)', fontWeight: 300, letterSpacing: '-0.02em' }}>
            Real conversations,
            <br />
            <span className="accent-italic text-prism">quietly arranged.</span>
          </h2>
          <p className="font-sans text-cream-100/60 mt-7" style={{ fontSize: '1rem', lineHeight: 1.85, fontWeight: 300 }}>
            Once two members align, a private introduction opens. No performance, no
            noise — just a calm space to discover the person behind the profile. When
            you&apos;re ready to meet, a concierge handles the details.
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            {['Private by default', 'Read receipts you control', 'Concierge date planning'].map((t, i) => {
              const c = ['#9BCBB4', '#B8A8D4', '#E8C7A0'][i]
              return (
                <span key={t} className="font-sans" style={{ fontSize: '0.72rem', letterSpacing: '0.04em', padding: '7px 13px', borderRadius: 999, color: 'rgba(245,237,224,0.8)', background: `${c}14`, border: `1px solid ${c}33` }}>{t}</span>
              )
            })}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
