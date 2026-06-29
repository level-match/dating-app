import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import wordmarkUrl from '../../assets/level-wordmark.png'

const NAV_LINKS = [
  { label: 'Philosophy',  href: '#philosophy' },
  { label: 'Matching',    href: '#matching' },
  { label: 'Inclusivity', href: '#inclusivity' },
  { label: 'Stories',     href: '#stories' },
]

function Wordmark() {
  return (
    <a href="/" className="group flex items-center gap-2.5">
      <span
        className="block w-2 h-2 rounded-full transition-transform duration-500 group-hover:scale-110"
        style={{
          background:
            'conic-gradient(from 220deg, #E8C7A0, #E5B5B5, #B8A8D4, #9BCBB4, #E8C7A0)',
          boxShadow: '0 0 12px rgba(212,165,116,0.55)',
        }}
      />
      <img
        src={wordmarkUrl}
        alt="LEVEL"
        className="block"
        style={{ height: '20px', width: 'auto' }}
      />
    </a>
  )
}

function EntranceOverlay({ label }) {
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        background:
          'radial-gradient(ellipse at center, rgba(11,8,25,0.92) 0%, rgba(6,5,18,0.98) 70%)',
        backdropFilter: 'blur(18px) saturate(1.1)',
        WebkitBackdropFilter: 'blur(18px) saturate(1.1)',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Soft ambient halo */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(232,199,160,0.10), transparent 70%)',
        }}
      />

      <div className="relative flex flex-col items-center" style={{ gap: '28px' }}>
        {/* Pulsing conic-gradient orb */}
        <motion.div
          className="relative"
          animate={{ scale: [1, 1.12, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <motion.div
            className="rounded-full"
            style={{
              width: 18,
              height: 18,
              background:
                'conic-gradient(from 220deg, #E8C7A0, #E5B5B5, #B8A8D4, #9BCBB4, #E8C7A0)',
              boxShadow:
                '0 0 32px rgba(212,165,116,0.75), 0 0 64px rgba(184,168,212,0.35)',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          />
        </motion.div>

        {/* Wordmark */}
        <div
          className="font-sans text-cream-50"
          style={{
            fontSize: '0.95rem',
            letterSpacing: '0.42em',
            fontWeight: 500,
            textTransform: 'uppercase',
          }}
        >
          Level
        </div>

        {/* Status line */}
        <motion.div
          className="font-serif italic text-cream-100/55 text-center"
          style={{ fontSize: '0.82rem', letterSpacing: '0.02em' }}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.5 }}
        >
          {label}
        </motion.div>

        {/* Shimmer bar */}
        <div
          className="overflow-hidden rounded-full"
          style={{
            width: 180,
            height: 1.5,
            background: 'rgba(245,237,224,0.08)',
            marginTop: 4,
          }}
        >
          <motion.div
            style={{
              height: '100%',
              width: '40%',
              background:
                'linear-gradient(90deg, transparent, #E8C7A0 50%, transparent)',
            }}
            animate={{ x: ['-100%', '350%'] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </div>
    </motion.div>
  )
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [entrance, setEntrance] = useState(null) // { href, label } | null

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function handleEntrance(e, href, label) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return // let new-tab clicks pass through
    e.preventDefault()
    setMenuOpen(false)
    setEntrance({ href, label })
    window.setTimeout(() => { window.location.href = href }, 900)
  }

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
      style={{
        background: scrolled ? 'rgba(11,8,25,0.78)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px) saturate(1.2)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(20px) saturate(1.2)' : 'none',
        borderBottom: scrolled
          ? '1px solid rgba(245,237,224,0.06)'
          : '1px solid transparent',
      }}
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-10 h-[76px] flex items-center justify-between">
        <Wordmark />

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-10">
          {NAV_LINKS.map(link => (
            <a
              key={link.label}
              href={link.href}
              className="relative font-sans text-cream-100/65 hover:text-cream-100 transition-colors duration-300 group"
              style={{ fontSize: '0.84rem', fontWeight: 400, letterSpacing: '0.02em' }}
            >
              {link.label}
              <span
                className="absolute -bottom-1.5 left-0 right-0 h-px scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, #E8C7A0 35%, #B8A8D4 70%, transparent)',
                }}
              />
            </a>
          ))}
        </div>

        {/* CTAs */}
        <div className="hidden lg:flex items-center gap-4">
          <a
            href="auth.html"
            onClick={e => handleEntrance(e, 'auth.html', 'Opening your sign in…')}
            className="font-sans text-cream-100/55 hover:text-cream-100 transition-colors duration-300"
            style={{ fontSize: '0.84rem' }}
          >
            Sign in
          </a>
          <a
            href="auth.html?mode=register"
            onClick={e => handleEntrance(e, 'auth.html?mode=register', 'Getting you in…')}
            className="font-sans font-medium px-5 py-2.5 rounded-full transition-all duration-400"
            style={{
              fontSize: '0.76rem',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#1A1335',
              background:
                'linear-gradient(135deg, #E8C7A0 0%, #D4A574 60%, #B8854D 100%)',
              boxShadow: '0 4px 18px rgba(212,165,116,0.28)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow =
                '0 10px 28px rgba(212,165,116,0.45), 0 0 30px rgba(232,199,160,0.25)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 18px rgba(212,165,116,0.28)'
            }}
          >
            Get Early Access
          </a>
        </div>

        {/* Mobile burger */}
        <button
          className="lg:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Toggle menu"
        >
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="block h-px transition-all duration-300"
              style={{
                width: i === 1 ? '16px' : '22px',
                background: 'rgba(245,237,224,0.78)',
                opacity: i === 1 && menuOpen ? 0 : 1,
                transform:
                  menuOpen && i === 0 ? 'rotate(45deg) translate(2px, 3px)' :
                  menuOpen && i === 2 ? 'rotate(-45deg) translate(2px, -3px)' :
                  'none',
              }}
            />
          ))}
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="lg:hidden overflow-hidden"
            style={{
              background: 'rgba(11,8,25,0.96)',
              backdropFilter: 'blur(24px)',
              borderTop: '1px solid rgba(245,237,224,0.07)',
            }}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="px-6 py-8 flex flex-col gap-5">
              {NAV_LINKS.map(link => (
                <a
                  key={link.label}
                  href={link.href}
                  className="font-sans text-cream-100/65 hover:text-cream-100 transition-colors"
                  style={{ fontSize: '0.95rem', letterSpacing: '0.04em' }}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div
                className="flex flex-col gap-3 pt-5"
                style={{ borderTop: '1px solid rgba(245,237,224,0.07)' }}
              >
                <a
                  href="auth.html"
                  onClick={e => handleEntrance(e, 'auth.html', 'Opening your sign in…')}
                  className="btn-ghost text-center text-sm"
                >
                  Sign in
                </a>
                <a
                  href="auth.html?mode=register"
                  onClick={e => handleEntrance(e, 'auth.html?mode=register', 'Getting you in…')}
                  className="btn-primary text-center text-sm"
                >
                  Sign Up
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading overlay shown when entering Sign in / Begin */}
      <AnimatePresence>
        {entrance && <EntranceOverlay label={entrance.label} />}
      </AnimatePresence>
    </motion.nav>
  )
}
