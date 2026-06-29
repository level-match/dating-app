import { motion } from 'framer-motion'

const SOCIALS = [
  {
    label: 'Instagram',
    href: '#',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: 'TikTok',
    href: '#',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" />
      </svg>
    ),
  },
  {
    label: 'Spotify',
    href: '#',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M7 9c3-1 7-1 10 1" />
        <path d="M7.5 12c2.5-.8 6-.8 8.5.7" />
        <path d="M8 15c2-.6 4.5-.6 6.5.5" />
      </svg>
    ),
  },
  {
    label: 'Substack',
    href: '#',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M4 4h16v2.5H4zM4 9.5h16V12H4zM4 15h16v6l-8-4.5L4 21z" />
      </svg>
    ),
  },
]

export default function SocialSection() {
  return (
    <section
      id="social"
      className="relative py-16 px-6 lg:px-10"
      style={{ borderTop: '1px solid rgba(245,237,224,0.05)' }}
    >
      <div className="max-w-7xl mx-auto">
        <motion.div
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-8"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div>
            <p className="eyebrow" style={{ color: 'rgba(245,237,224,0.50)' }}>
              The Quiet Hours
            </p>
            <p
              className="font-display text-cream-100/85 mt-2"
              style={{ fontSize: '1.15rem', fontWeight: 300 }}
            >
              Our editorial — relationships, identity, and the
              <span className="accent-italic text-champagne"> life you're building.</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            {SOCIALS.map((s, i) => (
              <motion.a
                key={s.label}
                href={s.href}
                aria-label={s.label}
                className="flex items-center justify-center text-cream-100/55 hover:text-cream-100 transition-all duration-300"
                style={{
                  width: '44px', height: '44px',
                  borderRadius: '50%',
                  background: 'rgba(245,237,224,0.04)',
                  border: '1px solid rgba(245,237,224,0.10)',
                }}
                whileHover={{
                  scale: 1.10,
                  backgroundColor: 'rgba(232,199,160,0.10)',
                  borderColor: 'rgba(232,199,160,0.35)',
                  boxShadow: '0 0 18px rgba(232,199,160,0.18)',
                }}
                whileTap={{ scale: 0.94 }}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.07 }}
              >
                {s.icon}
              </motion.a>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
