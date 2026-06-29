import { motion } from 'framer-motion'
import emp from '../../assets/restaurants/eleven-madison-park.jpg'
import bernardin from '../../assets/restaurants/le-barnardin.jpg'
import gramercy from '../../assets/restaurants/gramercy-tavern.jpg'
import perse from '../../assets/restaurants/per-se.jpg'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] },
})

const PLACES = [
  { img: emp, name: 'Eleven Madison Park', meta: 'Tasting · Flatiron', tag: 'Priority' },
  { img: bernardin, name: 'Le Bernardin', meta: 'Seafood · Midtown', tag: 'Tonight' },
  { img: gramercy, name: 'Gramercy Tavern', meta: 'American · Gramercy', tag: 'Priority' },
  { img: perse, name: 'Per Se', meta: 'French · Columbus Circle', tag: 'Member' },
]

function PlaceCard({ img, name, meta, tag }) {
  return (
    <div className="surface overflow-hidden" style={{ borderRadius: 16 }}>
      <div className="relative" style={{ aspectRatio: '3 / 2.2' }}>
        <img src={img} alt={name} className="absolute inset-0 w-full h-full object-cover" style={{ filter: 'saturate(0.96) contrast(1.02)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 38%, rgba(7,6,17,0.9) 100%)' }} />
        <span className="absolute font-sans" style={{ top: 10, right: 10, fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#E8C7A0', background: 'rgba(7,6,17,0.7)', border: '1px solid rgba(212,165,116,0.4)', padding: '3px 8px', borderRadius: 999, backdropFilter: 'blur(6px)' }}>{tag}</span>
        <div className="absolute left-0 right-0 bottom-0" style={{ padding: 12 }}>
          <div className="font-display text-cream-50" style={{ fontSize: '0.98rem', fontWeight: 400, lineHeight: 1.15 }}>{name}</div>
          <div className="font-sans text-cream-100/55" style={{ fontSize: '0.68rem', marginTop: 2 }}>{meta}</div>
        </div>
      </div>
    </div>
  )
}

export default function RestaurantSection() {
  return (
    <section id="experiences" className="relative py-28 lg:py-32 px-6 lg:px-10">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

        {/* Copy — left */}
        <motion.div className="max-w-xl" {...fadeUp()}>
          <div className="flex items-center gap-3 mb-6">
            <div className="hairline" />
            <span className="eyebrow">Restaurant Date Planning</span>
          </div>
          <h2 className="font-display text-cream-50 leading-[1.08] text-balance" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.4rem)', fontWeight: 300, letterSpacing: '-0.02em' }}>
            From aligned
            <br />
            <span className="accent-italic text-prism">to across the table.</span>
          </h2>
          <p className="font-sans text-cream-100/60 mt-7" style={{ fontSize: '1rem', lineHeight: 1.85, fontWeight: 300 }}>
            The hardest part of a first date should never be the logistics. LEVEL
            members enjoy priority reservations at 200+ curated restaurants — your
            concierge arranges the table, so you can simply show up and be present.
          </p>
          <div className="mt-8 flex items-center gap-8">
            <div>
              <div className="font-display text-prism" style={{ fontSize: '1.9rem', fontWeight: 300, letterSpacing: '-0.02em' }}>200+</div>
              <div className="font-sans text-cream-100/45" style={{ fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 2 }}>Partner restaurants</div>
            </div>
            <div className="hairline" style={{ transform: 'rotate(90deg)', width: 28 }} />
            <div>
              <div className="font-display text-prism" style={{ fontSize: '1.9rem', fontWeight: 300, letterSpacing: '-0.02em' }}>6</div>
              <div className="font-sans text-cream-100/45" style={{ fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 2 }}>Cities &amp; growing</div>
            </div>
          </div>
        </motion.div>

        {/* Visual — right: restaurant grid */}
        <motion.div {...fadeUp(0.1)}>
          <div className="grid grid-cols-2 gap-4">
            {PLACES.map((p, i) => (
              <div key={p.name} style={{ marginTop: i % 2 === 1 ? 28 : 0 }}>
                <PlaceCard {...p} />
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
