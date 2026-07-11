import { motion } from 'framer-motion'
import { maintenanceUrl } from '../../js/maintenance.js'

function StoreBadge({ kind = 'apple' }) {
  return (
    <motion.a
      href={maintenanceUrl('app-download')}
      className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl transition-all duration-300"
      style={{
        background: 'rgba(245,237,224,0.05)',
        border: '1px solid rgba(245,237,224,0.12)',
        backdropFilter: 'blur(12px)',
        minWidth: '170px',
      }}
      whileHover={{
        background: 'rgba(245,237,224,0.08)',
        borderColor: 'rgba(232,199,160,0.35)',
        boxShadow: '0 12px 32px rgba(7,6,17,0.5), 0 0 24px rgba(232,199,160,0.12)',
        y: -2,
      }}
      whileTap={{ scale: 0.97 }}
    >
      {kind === 'apple' ? (
        <svg width="22" height="26" viewBox="0 0 814 1000" fill="rgb(245,237,224)">
          <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-194.3 127.4-297.5 252.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
        </svg>
      ) : (
        <svg width="22" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M3 3.5L14.5 12 3 20.5V3.5Z" fill="#9BCBB4" />
          <path d="M3 3.5L14.5 12 9.5 17 3 20.5V3.5Z" fill="#B8A8D4" opacity="0.85" />
          <path d="M14.5 12L20 8.5 14.5 12 20 15.5 14.5 12Z" fill="#E8C7A0" opacity="0.9" />
          <path d="M3 20.5L9.5 17 14.5 12 20 15.5 3 20.5Z" fill="#E5B5B5" opacity="0.85" />
        </svg>
      )}
      <div>
        <p className="font-sans text-cream-100/45" style={{ fontSize: '0.6rem', letterSpacing: '0.08em' }}>
          {kind === 'apple' ? 'Download on the' : 'Get it on'}
        </p>
        <p className="font-sans font-medium text-cream-50" style={{ fontSize: '0.92rem', lineHeight: 1.2 }}>
          {kind === 'apple' ? 'App Store' : 'Google Play'}
        </p>
      </div>
    </motion.a>
  )
}

export default function AppDownloadSection() {
  return (
    <section
      id="download"
      className="relative py-24 px-6 lg:px-10 overflow-hidden"
      style={{ borderTop: '1px solid rgba(245,237,224,0.05)' }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 60% at 30% 50%, rgba(232,199,160,0.08) 0%, transparent 70%)',
        }}
      />

      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          className="grid lg:grid-cols-2 gap-10 items-center"
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="hairline" />
              <span className="eyebrow">Take LEVEL with you</span>
            </div>
            <p
              className="font-display text-cream-50 mb-5 leading-tight"
              style={{ fontSize: 'clamp(1.6rem, 3vw, 2.3rem)', fontWeight: 300, letterSpacing: '-0.02em' }}
            >
              Designed for quiet moments,
              <br />
              <span className="accent-italic text-champagne">not endless scrolling.</span>
            </p>
            <p
              className="font-sans text-cream-100/50 max-w-md"
              style={{ fontSize: '0.95rem', lineHeight: 1.85, fontWeight: 300 }}
            >
              The LEVEL app pairs the considered curation of the platform with
              a private, ad-free, distraction-free experience on iOS and Android.
            </p>
          </div>

          <div className="flex items-center gap-4 flex-wrap lg:justify-end">
            <StoreBadge kind="apple" />
            <StoreBadge kind="google" />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
