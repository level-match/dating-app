import { motion } from 'framer-motion'
import adrianReyesImg from '/assets/adrian.jpg'
import miaSantosImg   from '/assets/mia.jpg'
import danielCruzImg  from '/assets/daniel.jpg'
import sarahMImg      from '/assets/sarah.jpg'
import jamesTImg      from '/assets/james.jpg'

const CARDS = [
  {
    name: 'Mia Santos',
    pronouns: 'she/her',
    role: 'Pediatric surgeon, 36',
    location: 'Madrid',
    image: miaSantosImg,
    quote:
      "LEVEL felt different from the start — no small talk, just real conversations. I met someone who shared my values and direction. It wasn't about finding anyone, it was about finding the right one.",
    accent: '#E5B5B5',
  },
  {
    name: 'Adrian Reyes',
    pronouns: 'he/him',
    role: 'Founder, climate tech',
    location: 'New York',
    image: adrianReyesImg,
    quote:
      "I joined LEVEL expecting the usual, but it felt different immediately. Conversations had depth, and people knew what they wanted. Within days, I met someone who matched my mindset and pace.",
    accent: '#E8C7A0',
  },
  {
    name: 'Sarah M.',
    pronouns: 'she/they',
    role: 'Partner, intellectual property',
    location: 'London',
    image: sarahMImg,
    quote:
      "I was finally on a platform that took my pronouns and my partner preferences seriously from the first question. The matches were thoughtful, not performative — that mattered enormously.",
    accent: '#B8A8D4',
  },
  {
    name: 'Daniel Cruz',
    pronouns: 'he/him',
    role: 'Creative director',
    location: 'Mexico City',
    image: danielCruzImg,
    quote:
      "No endless swiping — just meaningful connections. I met someone who truly aligned with my goals, and everything flowed naturally from there.",
    accent: '#9BCBB4',
  },
  {
    name: 'James T.',
    pronouns: 'he/they',
    role: 'Cardiothoracic surgeon',
    location: 'Toronto',
    image: jamesTImg,
    quote:
      "As a gay man building a career and a family, I was tired of platforms that flattened me into a single category. LEVEL met me as a whole person — and I met a partner who does the same.",
    accent: '#D4A574',
  },
]

function Card({ card, large = false }) {
  return (
    <motion.article
      className="relative h-full rounded-3xl overflow-hidden surface surface-hover flex flex-col"
      style={{ minHeight: large ? '460px' : '380px' }}
      whileHover={{ y: -6 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Top accent line */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${card.accent}, transparent)`,
        }}
      />

      {/* Portrait */}
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {card.image && (
          <img
            src={card.image}
            alt={card.name}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            style={{ filter: 'saturate(0.92) contrast(1.02)' }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, transparent 40%, rgba(7,6,17,0.85) 100%)`,
          }}
        />
        <div
          className="absolute inset-0 mix-blend-soft-light"
          style={{
            background: `radial-gradient(ellipse at 50% 100%, ${card.accent}33 0%, transparent 65%)`,
          }}
        />

        {/* Pronoun chip */}
        <div className="absolute top-4 left-4">
          <span
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
            style={{
              background: 'rgba(11,8,25,0.7)',
              backdropFilter: 'blur(10px)',
              border: `1px solid ${card.accent}55`,
              color: card.accent,
              fontSize: '0.7rem',
              letterSpacing: '0.04em',
            }}
          >
            <span
              className="w-1 h-1 rounded-full"
              style={{ background: card.accent }}
            />
            {card.pronouns}
          </span>
        </div>
      </div>

      {/* Text */}
      <div className="px-7 py-6 flex flex-col flex-1">
        <p
          className="font-display text-cream-50 mb-1"
          style={{ fontSize: '1.25rem', fontWeight: 400, letterSpacing: '-0.005em' }}
        >
          {card.name}
        </p>
        <p
          className="font-sans text-cream-100/45 mb-5"
          style={{ fontSize: '0.78rem', letterSpacing: '0.04em' }}
        >
          {card.role} · {card.location}
        </p>
        <p
          className="font-sans text-cream-100/75 flex-1"
          style={{ fontSize: '0.9rem', lineHeight: 1.85, fontWeight: 300 }}
        >
          &ldquo;{card.quote}&rdquo;
        </p>

        <div
          className="flex items-center gap-2 mt-6"
          style={{ borderTop: '1px solid rgba(245,237,224,0.06)', paddingTop: '14px' }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: card.accent }}
          />
          <span
            className="font-sans text-cream-100/45"
            style={{ fontSize: '0.66rem', letterSpacing: '0.18em', textTransform: 'uppercase' }}
          >
            Verified member
          </span>
        </div>
      </div>
    </motion.article>
  )
}

export default function TestimonialsSection() {
  return (
    <section id="stories" className="relative py-32 px-6 lg:px-10 overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10">

        <motion.div
          className="flex items-end justify-between flex-wrap gap-8 mb-16"
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="hairline" />
              <span className="eyebrow">Stories</span>
            </div>
            <h2
              className="font-display text-cream-50 leading-[1.05] text-balance"
              style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', fontWeight: 300, letterSpacing: '-0.025em' }}
            >
              Connections that look
              <br />
              <span className="accent-italic text-prism">like real lives.</span>
            </h2>
          </div>
          <p
            className="font-sans text-cream-100/55 max-w-md"
            style={{ fontSize: '0.95rem', lineHeight: 1.85, fontWeight: 300 }}
          >
            Five members. Five chapters. Every story shared with consent — and
            every story possible because someone felt seen from the very first
            question.
          </p>
        </motion.div>

        {/* Masonry-ish 5-card grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {CARDS.slice(0, 3).map((card, i) => (
            <motion.div
              key={card.name}
              initial={{ opacity: 0, y: 36 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.9, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <Card card={card} />
            </motion.div>
          ))}
          {/* Second row — span two cards */}
          {CARDS.slice(3, 5).map((card, i) => (
            <motion.div
              key={card.name}
              className={`md:col-span-1 lg:col-span-${i === 0 ? '2' : '1'}`}
              initial={{ opacity: 0, y: 36 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.9, delay: 0.3 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <Card card={card} large={i === 0} />
            </motion.div>
          ))}
        </div>

        <motion.div
          className="text-center mt-16"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <a
            href="auth.html?mode=register"
            className="inline-flex items-center gap-3 font-sans text-cream-100/55 hover:text-cream-100 transition-colors duration-300"
            style={{ fontSize: '0.78rem', letterSpacing: '0.18em', textTransform: 'uppercase' }}
          >
            <div className="hairline" style={{ width: '40px' }} />
            Read every story
            <div className="hairline" style={{ width: '40px' }} />
          </a>
        </motion.div>
      </div>
    </section>
  )
}
