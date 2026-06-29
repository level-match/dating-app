import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UserPlus, SlidersHorizontal, GitMerge, MessageSquare } from 'lucide-react'

const STEPS = [
  {
    number: '01',
    title: 'Join',
    subtitle: 'Where intention begins',
    Icon: UserPlus,
    body: 'Tell us who you are and the relationship you hope to build.',
    emphasis: 'Intention, established from the very beginning.',
    accent: '#E8C7A0',
    detail: 'Intentions & relationship goals',
  },
  {
    number: '02',
    title: 'Personalise',
    subtitle: 'Built around who you are',
    Icon: SlidersHorizontal,
    body: 'Your values, lifestyle and ambitions shape a private profile built for real compatibility.',
    emphasis: 'Connection begins with the person behind the profile.',
    accent: '#E5B5B5',
    detail: '42 Compatibility Dimensions',
  },
  {
    number: '03',
    title: 'Align',
    subtitle: 'Curated introductions',
    Icon: GitMerge,
    body: 'Introductions chosen for shared values, intent, lifestyle, and life direction.',
    emphasis: 'Not proximity. Not popularity. Alignment.',
    accent: '#B8A8D4',
    detail: '4–6 introductions weekly',
  },
  {
    number: '04',
    title: 'Connect',
    subtitle: 'Meet with intention',
    Icon: MessageSquare,
    body: 'Private conversations, thoughtful introductions, and support when you need it.',
    emphasis: 'The platform stays quiet, so the connection can be loud.',
    accent: '#9BCBB4',
    detail: 'Concierge & advisor included',
  },
]

export default function ProcessSection() {
  const [active, setActive] = useState(0)
  const step = STEPS[active]

  return (
    <section id="philosophy" className="relative py-32 px-6 lg:px-10">
      <div className="max-w-7xl mx-auto">

        <motion.div
          className="max-w-3xl mb-20"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="hairline" />
            <span className="eyebrow">The process</span>
          </div>
          <h2
            className="font-display text-cream-50 leading-[1.05] text-balance"
            style={{ fontSize: 'clamp(2.2rem, 5vw, 4rem)', fontWeight: 300, letterSpacing: '-0.025em' }}
          >
            A Considered
            <br />
            <span className="accent-italic text-prism">Introduction.</span>
          </h2>
          <p
            className="font-sans text-cream-100/55 mt-7 max-w-xl"
            style={{ fontSize: '1rem', lineHeight: 1.85, fontWeight: 300 }}
          >
            Designed for Alignment. Not Attention.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-12 gap-10 items-start">
          {/* Step rail */}
          <div className="lg:col-span-5 flex flex-col gap-2">
            {STEPS.map((s, i) => {
              const isActive = i === active
              return (
                <button
                  key={s.number}
                  onClick={() => setActive(i)}
                  className="group text-left relative px-6 py-5 rounded-2xl transition-all duration-500"
                  style={{
                    background: isActive
                      ? 'rgba(245,237,224,0.04)'
                      : 'transparent',
                    border: `1px solid ${isActive ? 'rgba(212,165,116,0.28)' : 'rgba(245,237,224,0.06)'}`,
                  }}
                >
                  <div className="flex items-center gap-5">
                    <span
                      className="font-display flex-shrink-0 transition-colors duration-500"
                      style={{
                        fontSize: '2.4rem',
                        fontWeight: 300,
                        lineHeight: 1,
                        letterSpacing: '-0.02em',
                        color: isActive ? s.accent : 'rgba(245,237,224,0.20)',
                      }}
                    >
                      {s.number}
                    </span>
                    <span
                      className="flex items-center justify-center flex-shrink-0 transition-all duration-500"
                      style={{ width: 34, height: 34, borderRadius: 10, color: isActive ? s.accent : 'rgba(245,237,224,0.32)', background: isActive ? `${s.accent}14` : 'transparent', border: `1px solid ${isActive ? `${s.accent}3A` : 'rgba(245,237,224,0.08)'}` }}
                    >
                      <s.Icon size={17} strokeWidth={1.6} />
                    </span>
                    <div className="flex-1">
                      <div
                        className="font-display transition-colors duration-500"
                        style={{
                          fontSize: '1.5rem',
                          fontWeight: 400,
                          letterSpacing: '-0.01em',
                          color: isActive ? 'var(--ink-100)' : 'rgba(245,237,224,0.55)',
                        }}
                      >
                        {s.title}
                      </div>
                      <div
                        className="font-sans transition-colors duration-500"
                        style={{
                          fontSize: '0.82rem',
                          color: isActive ? 'rgba(245,237,224,0.65)' : 'rgba(245,237,224,0.35)',
                          marginTop: '2px',
                        }}
                      >
                        {s.subtitle}
                      </div>
                    </div>
                    <span
                      className="w-2 h-2 rounded-full transition-all duration-500"
                      style={{
                        background: isActive ? s.accent : 'rgba(245,237,224,0.18)',
                        boxShadow: isActive ? `0 0 14px ${s.accent}` : 'none',
                      }}
                    />
                  </div>
                </button>
              )
            })}
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-7 relative">
            <div className="surface rounded-3xl p-10 lg:p-12 min-h-[400px] relative overflow-hidden">
              {/* Accent halo */}
              <div
                key={`halo-${active}`}
                className="absolute pointer-events-none"
                style={{
                  width: '380px',
                  height: '380px',
                  top: '-100px',
                  right: '-100px',
                  background: `radial-gradient(circle, ${step.accent}33 0%, transparent 65%)`,
                  filter: 'blur(40px)',
                  animation: 'fadeUp 1s cubic-bezier(0.16,1,0.3,1) both',
                }}
              />

              <AnimatePresence mode="wait">
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -18 }}
                  transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                  className="relative"
                >
                  <div
                    className="font-display text-cream-50/15 mb-6 leading-none"
                    style={{ fontSize: '6rem', fontWeight: 300, letterSpacing: '-0.04em' }}
                  >
                    {step.number}
                  </div>
                  <p
                    className="eyebrow mb-3"
                    style={{ color: step.accent }}
                  >
                    {step.subtitle}
                  </p>
                  <h3
                    className="font-display text-cream-50 mb-6"
                    style={{ fontSize: '2.4rem', fontWeight: 300, letterSpacing: '-0.02em' }}
                  >
                    {step.title}
                  </h3>
                  <p
                    className="font-sans text-cream-100/70 max-w-lg"
                    style={{ fontSize: '1rem', lineHeight: 1.9, fontWeight: 300 }}
                  >
                    {step.body}
                  </p>

                  {step.emphasis && (
                    <p
                      className="font-display accent-italic max-w-md mt-6"
                      style={{ fontSize: '1.3rem', lineHeight: 1.5, color: step.accent }}
                    >
                      {step.emphasis}
                    </p>
                  )}

                  <div
                    className="mt-10 inline-flex items-center gap-3 px-4 py-2 rounded-full"
                    style={{
                      background: `${step.accent}14`,
                      border: `1px solid ${step.accent}40`,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: step.accent, boxShadow: `0 0 10px ${step.accent}` }}
                    />
                    <span
                      className="font-sans text-cream-100/80"
                      style={{ fontSize: '0.78rem', letterSpacing: '0.08em' }}
                    >
                      {step.detail}
                    </span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
