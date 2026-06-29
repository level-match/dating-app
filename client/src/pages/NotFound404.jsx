import { motion } from 'framer-motion'

const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`

const SPARKLES = [
  { cx: 72,  cy: 102, r: 1.6, color: '#D4AF5A', delay: 1.8 },
  { cx: 118, cy: 52,  r: 1.1, color: '#E2C97E', delay: 2.1 },
  { cx: 48,  cy: 148, r: 0.9, color: '#B8903A', delay: 2.4 },
  { cx: 408, cy: 102, r: 1.6, color: '#55E2E9', delay: 1.8 },
  { cx: 362, cy: 52,  r: 1.1, color: '#04BADE', delay: 2.1 },
  { cx: 432, cy: 148, r: 0.9, color: '#0496C7', delay: 2.4 },
]

function ConnectionIllustration() {
  return (
    <svg
      viewBox="0 0 480 260"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', maxWidth: '420px' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="nn-gold" x1="25" y1="250" x2="192" y2="152" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#8B6914" stopOpacity="0.25" />
          <stop offset="55%"  stopColor="#D4AF5A" stopOpacity="0.9"  />
          <stop offset="100%" stopColor="#E2C97E" stopOpacity="1"    />
        </linearGradient>
        <linearGradient id="nn-blue" x1="455" y1="250" x2="288" y2="152" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#003A5C" stopOpacity="0.25" />
          <stop offset="55%"  stopColor="#0496C7" stopOpacity="0.9"  />
          <stop offset="100%" stopColor="#55E2E9" stopOpacity="1"    />
        </linearGradient>
        <radialGradient id="nn-gap" cx="50%" cy="55%" r="50%">
          <stop offset="0%"   stopColor="#D4AF5A" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#D4AF5A" stopOpacity="0"    />
        </radialGradient>
        <filter id="nn-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="nn-heart-glow" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Soft ambient glow in gap */}
      <ellipse cx="240" cy="152" rx="72" ry="46" fill="url(#nn-gap)" />

      {/* Dashed "would-be" arc — the missed connection */}
      <path
        d="M 192,152 Q 240,108 288,152"
        stroke="rgba(212,175,90,0.14)"
        strokeWidth="1"
        strokeDasharray="3 5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Left thread — gold, draws in from bottom */}
      <motion.path
        d="M 25,250 C 38,220 18,195 42,165 C 66,135 108,145 112,112 C 116,79 96,60 118,38 C 132,24 158,28 168,50 C 178,72 168,102 172,126 C 174,138 178,145 192,152"
        stroke="url(#nn-gold)"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 2.4, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Left ornament — outer ring */}
      <motion.circle
        cx="192" cy="152" r="7"
        stroke="#D4AF5A" strokeWidth="1.4" fill="none"
        filter="url(#nn-glow)"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 2.7, type: 'spring', stiffness: 220 }}
      />
      {/* Left ornament — inner dot */}
      <motion.circle
        cx="192" cy="152" r="2.5"
        fill="#D4AF5A"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.9 }}
        transition={{ duration: 0.4, delay: 2.85 }}
      />

      {/* Right thread — blue, draws in from bottom */}
      <motion.path
        d="M 455,250 C 442,220 462,195 438,165 C 414,135 372,145 368,112 C 364,79 384,60 362,38 C 348,24 322,28 312,50 C 302,72 312,102 308,126 C 306,138 302,145 288,152"
        stroke="url(#nn-blue)"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 2.4, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Right ornament — outer ring */}
      <motion.circle
        cx="288" cy="152" r="7"
        stroke="#55E2E9" strokeWidth="1.4" fill="none"
        filter="url(#nn-glow)"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 2.9, type: 'spring', stiffness: 220 }}
      />
      {/* Right ornament — inner dot */}
      <motion.circle
        cx="288" cy="152" r="2.5"
        fill="#55E2E9"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.9 }}
        transition={{ duration: 0.4, delay: 3.05 }}
      />

      {/* Heart floating in the gap */}
      <motion.path
        d="M 240,163 C 240,163 225,153 225,145 C 225,139 230,136 234,139 C 237,141 240,144 240,144 C 240,144 243,141 246,139 C 250,136 255,139 255,145 C 255,153 240,163 240,163 Z"
        stroke="#D4AF5A"
        strokeWidth="1.1"
        fill="rgba(212,175,90,0.09)"
        filter="url(#nn-heart-glow)"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.85 }}
        transition={{ duration: 0.9, delay: 3.2, type: 'spring', stiffness: 160, damping: 10 }}
      />

      {/* Sparkle dots */}
      {SPARKLES.map((s, i) => (
        <motion.circle
          key={i}
          cx={s.cx} cy={s.cy} r={s.r}
          fill={s.color}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.85, 0.2, 0.85, 0] }}
          transition={{
            duration: 3.5,
            delay: s.delay,
            repeat: Infinity,
            repeatDelay: 1.8,
            ease: 'easeInOut',
          }}
        />
      ))}
    </svg>
  )
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.95, delay, ease: [0.16, 1, 0.3, 1] },
})

export default function NotFound404() {
  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{ background: '#010F24' }}
    >
      {/* Deep navy gradient */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(160deg, #010F24 0%, #021E4A 25%, #02367B 45%, #006CA5 65%, #010F24 100%)',
        }}
      />

      {/* Ambient glow blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute animate-ambient-pulse"
          style={{
            width: '65vw', height: '65vw',
            top: '-15vw', left: '-12vw',
            background: 'radial-gradient(circle, rgba(2,54,123,0.55) 0%, transparent 70%)',
            filter: 'blur(90px)',
          }}
        />
        <div
          className="absolute animate-ambient-pulse"
          style={{
            width: '55vw', height: '55vw',
            bottom: '-5vw', right: '-10vw',
            background: 'radial-gradient(circle, rgba(4,150,199,0.28) 0%, transparent 70%)',
            filter: 'blur(80px)',
            animationDelay: '2s',
          }}
        />
        <div
          className="absolute animate-ambient-pulse"
          style={{
            width: '35vw', height: '35vw',
            top: '35vh', left: '32vw',
            background: 'radial-gradient(circle, rgba(212,175,90,0.07) 0%, transparent 70%)',
            filter: 'blur(70px)',
            animationDelay: '4s',
          }}
        />
      </div>

      {/* Grain texture */}
      <div
        className="fixed inset-0 pointer-events-none animate-grain"
        style={{
          backgroundImage: GRAIN_SVG,
          backgroundRepeat: 'repeat',
          backgroundSize: '180px 180px',
          opacity: 0.032,
          mixBlendMode: 'overlay',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 py-16 max-w-4xl mx-auto w-full">

        {/* Overline */}
        <motion.div
          className="flex items-center gap-4 mb-10"
          {...fadeUp(0.2)}
        >
          <div className="divider-gold" />
          <span className="label-overline">LEVEL — Private Membership</span>
          <div className="divider-gold" />
        </motion.div>

        {/* Floating illustration */}
        <motion.div
          className="mb-1 w-full flex justify-center"
          animate={{ y: [0, -14, 0] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <ConnectionIllustration />
          </motion.div>
        </motion.div>

        {/* 404 */}
        <motion.div {...fadeUp(0.5)}>
          <h1
            className="font-serif leading-none select-none"
            style={{
              fontSize: 'clamp(7rem, 18vw, 13rem)',
              fontWeight: 300,
              letterSpacing: '-0.04em',
              background:
                'linear-gradient(105deg, #B8903A 0%, #F0DFA8 42%, #D4AF5A 68%, #B8903A 100%)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              lineHeight: 0.9,
            }}
          >
            404
          </h1>
        </motion.div>

        {/* Headline */}
        <motion.h2
          className="font-serif mt-4"
          style={{
            fontSize: 'clamp(1.5rem, 4vw, 2.6rem)',
            fontWeight: 400,
            letterSpacing: '-0.01em',
            color: '#F0DFA8',
          }}
          {...fadeUp(0.65)}
        >
          Connection Not Found
        </motion.h2>

        {/* Gold divider */}
        <motion.div
          className="my-6 flex justify-center"
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.9, delay: 0.82, ease: [0.16, 1, 0.3, 1] }}
        >
          <div style={{ width: '80px', height: '1px', background: 'linear-gradient(90deg, transparent, #D4AF5A, transparent)' }} />
        </motion.div>

        {/* Subtext */}
        <motion.p
          className="font-sans font-light max-w-sm leading-relaxed"
          style={{ fontSize: '1rem', lineHeight: 1.85, color: 'rgba(255,255,255,0.45)' }}
          {...fadeUp(0.88)}
        >
          The page you're looking for seems to have stepped away from the table.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          className="flex items-center gap-4 mt-10 flex-wrap justify-center"
          {...fadeUp(1.05)}
        >
          <a href="/" className="btn-primary">
            Return to LEVEL
          </a>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="btn-ghost"
          >
            Go Back
          </button>
        </motion.div>

        {/* Bottom wordmark */}
        <motion.div
          className="mt-20 flex items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 1.3 }}
        >
          <div style={{ width: '28px', height: '1px', background: 'rgba(212,175,90,0.18)' }} />
          <span
            className="font-sans font-light"
            style={{ fontSize: '0.6rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(212,175,90,0.28)' }}
          >
            Level
          </span>
          <div style={{ width: '28px', height: '1px', background: 'rgba(212,175,90,0.18)' }} />
        </motion.div>

      </div>
    </div>
  )
}
