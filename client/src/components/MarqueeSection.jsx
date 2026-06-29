import { motion } from 'framer-motion'

const ROW_A = [
  'Surgeons',
  'Founders',
  'Architects',
  'Curators',
  'Diplomats',
  'Researchers',
  'Designers',
  'Investors',
  'Authors',
  'Cinematographers',
  'Chefs',
  'Strategists',
]

const ROW_B = [
  'Single parents',
  'New in town',
  'Recently divorced',
  'Long-term seeking',
  'LGBTQIA+',
  'Bicoastal',
  'Quietly ambitious',
  'Building a family',
  'Returning to dating',
  'Career pivoting',
  'Sober & curious',
  'Open to anywhere',
]

const DOT = (color = 'rgba(232,199,160,0.35)') => (
  <span
    className="inline-block mx-7"
    style={{ fontSize: '0.55rem', verticalAlign: 'middle', color, lineHeight: 1 }}
  >
    ◆
  </span>
)

function MarqueeRow({ items, reverse = false, dotColor }) {
  const doubled = [...items, ...items]
  return (
    <div className="overflow-hidden w-full">
      <div
        className={`flex whitespace-nowrap ${reverse ? 'animate-marquee-reverse' : 'animate-marquee'}`}
        style={{ width: 'max-content' }}
      >
        {doubled.map((label, i) => (
          <span key={i} className="inline-flex items-center">
            <span
              className="font-display text-cream-100/40 hover:text-champagne-300 transition-colors duration-500 cursor-default"
              style={{ fontSize: '1.05rem', letterSpacing: '0.01em', fontWeight: 300 }}
            >
              {label}
            </span>
            {DOT(dotColor)}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function MarqueeSection() {
  return (
    <section className="relative py-24 overflow-hidden">
      {/* Side fades */}
      <div
        className="absolute left-0 top-0 bottom-0 w-32 pointer-events-none z-10"
        style={{
          background:
            'linear-gradient(to right, rgba(7,6,17,1), transparent)',
        }}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-32 pointer-events-none z-10"
        style={{
          background:
            'linear-gradient(to left, rgba(7,6,17,1), transparent)',
        }}
      />

      <motion.div
        className="max-w-7xl mx-auto px-6 lg:px-10 mb-12"
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-baseline justify-between gap-8 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="hairline" />
            <span className="eyebrow">Our membership</span>
          </div>
          <p
            className="font-display text-cream-100/70 max-w-md"
            style={{ fontSize: '1.05rem', fontWeight: 300, lineHeight: 1.7 }}
          >
            The people on LEVEL are accomplished, complex and seeking the
            <span className="accent-italic text-champagne-300"> same kind of life</span> you are.
          </p>
        </div>
      </motion.div>

      <motion.div
        className="space-y-6"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 1.2 }}
      >
        <MarqueeRow items={ROW_A} dotColor="rgba(232,199,160,0.30)" />
        <MarqueeRow items={ROW_B} reverse dotColor="rgba(184,168,212,0.30)" />
      </motion.div>
    </section>
  )
}
