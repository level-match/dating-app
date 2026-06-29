import { motion } from 'framer-motion'
import wordmarkUrl from '../../assets/level-wordmark.png'

const COLUMNS = [
  {
    title: 'Membership',
    links: ['Sign Up', 'How it works', 'Pricing', 'Concierge'],
  },
  {
    title: 'The platform',
    links: ['Philosophy', 'Matching system', 'Inclusivity', 'Stories'],
  },
  {
    title: 'Support',
    links: ['FAQ', 'Safety', 'Contact', 'Press'],
  },
  {
    title: 'Legal',
    links: ['Terms', 'Privacy', 'Cookies', 'Accessibility'],
  },
]

export default function Footer() {
  return (
    <footer
      className="relative px-6 lg:px-10 overflow-hidden"
      style={{ borderTop: '1px solid rgba(245,237,224,0.06)' }}
    >
      {/* Top gradient hairline */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent 10%, rgba(232,199,160,0.3) 30%, rgba(229,181,181,0.3) 50%, rgba(184,168,212,0.3) 70%, transparent 90%)',
        }}
      />

      <div className="max-w-7xl mx-auto py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9 }}
        >
          <div className="grid lg:grid-cols-12 gap-12 mb-16">

            {/* Brand block */}
            <div className="lg:col-span-5">
              <div className="flex items-center gap-2.5 mb-6">
                <span
                  className="block w-2 h-2 rounded-full"
                  style={{
                    background:
                      'conic-gradient(from 220deg, #E8C7A0, #E5B5B5, #B8A8D4, #9BCBB4, #E8C7A0)',
                    boxShadow: '0 0 10px rgba(212,165,116,0.55)',
                  }}
                />
                <img
                  src={wordmarkUrl}
                  alt="LEVEL"
                  className="block"
                  style={{ height: '19px', width: 'auto' }}
                />
              </div>
              <p
                className="font-sans text-cream-100/55 max-w-md mb-8"
                style={{ fontSize: '0.92rem', lineHeight: 1.85, fontWeight: 300 }}
              >
                LEVEL is a private membership for ambitious individuals — across
                every identity, orientation and chapter — building partnerships
                of equal depth and direction.
              </p>

              <a href="auth.html?mode=register" className="btn-prism">
                Get Early Access
              </a>
            </div>

            {/* Link columns */}
            <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-4 gap-8">
              {COLUMNS.map(col => (
                <div key={col.title}>
                  <p
                    className="font-sans text-cream-100/85 uppercase mb-5"
                    style={{ fontSize: '0.7rem', letterSpacing: '0.18em', fontWeight: 500 }}
                  >
                    {col.title}
                  </p>
                  <ul className="space-y-3">
                    {col.links.map(link => (
                      <li key={link}>
                        <a
                          href="#"
                          className="font-sans text-cream-100/50 hover:text-cream-100 transition-colors"
                          style={{ fontSize: '0.86rem' }}
                        >
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div
            className="pt-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-5"
            style={{ borderTop: '1px solid rgba(245,237,224,0.06)' }}
          >
            <p
              className="font-sans text-cream-100/35"
              style={{ fontSize: '0.78rem' }}
            >
              © {new Date().getFullYear()} Level LLC. All rights reserved.
            </p>
            <p
              className="font-sans accent-italic text-cream-100/45"
              style={{ fontSize: '0.86rem' }}
            >
              Designed for the lives behind the résumés.
            </p>
          </div>
        </motion.div>
      </div>
    </footer>
  )
}
