import { motion } from 'framer-motion'
import { LevelIcon } from './icons/LevelIcon.jsx'
import { Check } from 'lucide-react'

const TIERS = [
  {
    name: 'Core',
    tagline: 'The Foundation',
    price: '$195',
    period: '/month',
    description: 'For professionals beginning their journey with intentional partnership.',
    features: [
      '4 curated introductions per month',
      'Full compatibility profile',
      'In-app messaging',
      'Member events access',
      'Dedicated support',
    ],
    cta: 'Choose Core',
    highlight: false,
    accentColor: 'rgba(4, 186, 222, 0.6)',
    borderColor: 'rgba(4, 186, 222, 0.2)',
    bgAccent: 'rgba(4, 186, 222, 0.05)',
  },
  {
    name: 'Select',
    tagline: 'Most Chosen',
    price: '$450',
    period: '/month',
    description: 'The complete LEVEL experience. Preferred by members who take partnership seriously.',
    features: [
      '10 curated introductions per month',
      'Priority profile placement',
      'Concierge date planning',
      'Private dining reservations',
      'Exclusive member events',
      'Relationship advisor sessions',
      'Global member network access',
    ],
    cta: 'Choose Select',
    highlight: true,
    accentColor: 'rgba(212, 175, 90, 0.8)',
    borderColor: 'rgba(212, 175, 90, 0.35)',
    bgAccent: 'rgba(212, 175, 90, 0.04)',
  },
  {
    name: 'Elite',
    tagline: 'By Referral Only',
    price: 'Private',
    period: '',
    description: 'A fully bespoke matchmaking service for those who require the highest level of discretion and personalization.',
    features: [
      'Unlimited curated introductions',
      'Personal matchmaker',
      'Global search',
      'Full concierge service',
      'Private events & travel',
      'Total confidentiality protocol',
    ],
    cta: 'Inquire Privately',
    highlight: false,
    accentColor: 'rgba(240, 223, 168, 0.5)',
    borderColor: 'rgba(240, 223, 168, 0.15)',
    bgAccent: 'rgba(240, 223, 168, 0.02)',
  },
]

export default function MembershipSection() {
  return (
    <section
      id="membership"
      className="relative py-32 px-6 lg:px-12 overflow-hidden"
    >
      {/* Background glow */}
      <div
        className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          width: '50vw', height: '70vh',
          background: 'radial-gradient(ellipse, rgba(0, 108, 165, 0.25) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section header */}
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="divider-gold" />
            <span className="label-overline">Membership Tiers</span>
            <div className="divider-gold" />
          </div>
          <h2
            className="font-serif text-gold-200"
            style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', fontWeight: 400 }}
          >
            Choose Your Level
          </h2>
          <p
            className="font-sans font-light text-white/40 mt-4 max-w-lg mx-auto"
            style={{ fontSize: '0.95rem', lineHeight: 1.8 }}
          >
            Each tier offers the same standard of curation and care. The difference
            is in depth, frequency, and personalization.
          </p>
        </motion.div>

        {/* Tiers grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {TIERS.map((tier, i) => (
            <motion.div
              key={tier.name}
              className="relative"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: i * 0.12 }}
            >
              {/* Highlight badge */}
              {tier.highlight && (
                <div
                  className="absolute -top-4 left-1/2 -translate-x-1/2 z-10 px-5 py-1.5 whitespace-nowrap"
                  style={{
                    background: 'linear-gradient(135deg, #B8903A, #E2C97E)',
                    borderRadius: '2px',
                    boxShadow: '0 4px 20px rgba(212,175,90,0.3)',
                  }}
                >
                  <span
                    className="font-sans font-medium text-ocean-950"
                    style={{ fontSize: '0.65rem', letterSpacing: '0.16em', textTransform: 'uppercase' }}
                  >
                    {tier.tagline}
                  </span>
                </div>
              )}

              <div
                className="h-full rounded-sm p-8 flex flex-col transition-all duration-500"
                style={{
                  background: tier.highlight
                    ? 'rgba(212, 175, 90, 0.04)'
                    : 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${tier.borderColor}`,
                  backdropFilter: 'blur(20px)',
                  boxShadow: tier.highlight
                    ? '0 0 60px rgba(212,175,90,0.08), 0 16px 48px rgba(0,0,0,0.3)'
                    : '0 8px 32px rgba(0,0,0,0.2)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = tier.highlight
                    ? '0 0 80px rgba(212,175,90,0.15), 0 24px 60px rgba(0,0,0,0.4)'
                    : '0 16px 48px rgba(0,0,0,0.35)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = tier.highlight
                    ? '0 0 60px rgba(212,175,90,0.08), 0 16px 48px rgba(0,0,0,0.3)'
                    : '0 8px 32px rgba(0,0,0,0.2)'
                }}
              >
                {/* Tier name */}
                <div className="mb-8">
                  {!tier.highlight && (
                    <p
                      className="label-overline mb-2"
                      style={{ color: 'rgba(255,255,255,0.3)' }}
                    >
                      {tier.tagline}
                    </p>
                  )}
                  <h3
                    className="font-serif mb-1"
                    style={{
                      fontSize: '2rem',
                      fontWeight: 400,
                      color: tier.highlight ? '#E2C97E' : '#F0DFA8',
                    }}
                  >
                    {tier.name}
                  </h3>
                  <div className="flex items-baseline gap-1 mt-3">
                    <span
                      className="font-serif"
                      style={{
                        fontSize: '2.5rem',
                        fontWeight: 300,
                        color: tier.highlight ? '#D4AF5A' : 'rgba(240,223,168,0.7)',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {tier.price}
                    </span>
                    {tier.period && (
                      <span
                        className="font-sans font-light text-white/35"
                        style={{ fontSize: '0.8rem' }}
                      >
                        {tier.period}
                      </span>
                    )}
                  </div>
                  <p
                    className="font-sans font-light text-white/45 mt-3"
                    style={{ fontSize: '0.85rem', lineHeight: 1.7 }}
                  >
                    {tier.description}
                  </p>
                </div>

                {/* Features */}
                <div className="flex-1 space-y-3 mb-8">
                  {tier.features.map(feature => (
                    <div key={feature} className="flex items-start gap-3">
                      <LevelIcon
                        icon={Check}
                        size={14}
                        gradient={tier.highlight ? 'gold' : 'ocean'}
                        strokeWidth={2}
                        className="flex-shrink-0 mt-0.5"
                      />
                      <span
                        className="font-sans font-light text-white/55"
                        style={{ fontSize: '0.85rem', lineHeight: 1.6 }}
                      >
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <a
                  href="auth.html?mode=register"
                  className="block text-center py-3.5 rounded-sm font-sans font-medium text-sm uppercase tracking-wider transition-all duration-300"
                  style={{
                    letterSpacing: '0.12em',
                    fontSize: '0.75rem',
                    background: tier.highlight
                      ? 'linear-gradient(135deg, #B8903A, #E2C97E)'
                      : 'transparent',
                    border: tier.highlight
                      ? 'none'
                      : `1px solid ${tier.borderColor}`,
                    color: tier.highlight ? '#010F24' : 'rgba(240,223,168,0.7)',
                    boxShadow: tier.highlight ? '0 4px 20px rgba(212,175,90,0.25)' : 'none',
                  }}
                  onMouseEnter={e => {
                    if (!tier.highlight) {
                      e.currentTarget.style.color = '#F0DFA8'
                      e.currentTarget.style.background = `rgba(212,175,90,0.06)`
                    }
                  }}
                  onMouseLeave={e => {
                    if (!tier.highlight) {
                      e.currentTarget.style.color = 'rgba(240,223,168,0.7)'
                      e.currentTarget.style.background = 'transparent'
                    }
                  }}
                >
                  {tier.cta}
                </a>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Fine print */}
        <motion.p
          className="text-center font-sans font-light text-white/25 mt-10"
          style={{ fontSize: '0.75rem', letterSpacing: '0.06em' }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
        >
          All memberships are billed monthly. Cancel anytime. Get started in minutes.
        </motion.p>
      </div>
    </section>
  )
}
